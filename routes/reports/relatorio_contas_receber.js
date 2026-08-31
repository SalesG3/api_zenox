const { app, con, jwt, map } = require("../../server")
const { pdfmake, fonts, maskCpfCnpj, maskCurrency, maskCep, maskCell } = require('./reports.config')

async function relatorio_contas_receber(req){

    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE
    let [entidade] = (await con.promise().query('SELECT * FROM REPORT_ENTIDADE WHERE ID_ENTIDADE = ?', ID_ENTIDADE))[0]

    // CTEs:
    // - parcelas_abertas: só as parcelas ainda não pagas (DT_PAGAMENTO IS NULL) -> o que efetivamente
    //   aparece como linha do relatório e compõe o "Parcelas" (total em aberto) do rodapé.
    // - parcelas_totais: soma de TODAS as parcelas do título (pagas ou não) -> usada só para comparar
    //   com o valor do título (VL_FINANCEIRO) e detectar parcelamento incompleto. Não filtra por status
    //   de pagamento de propósito: uma parcela já paga não é "diferença", só uma parcela cadastrada
    //   corretamente que já foi quitada.
    let [rows] = await con.promise().query(`
        WITH parcelas_abertas AS (
            SELECT
                FP.ID_FINANCEIRO,
                FP.DT_FINANCEIRO_PARCELA,
                FP.VL_FINANCEIRO_PARCELA,
                FP.NU_DOCUMENTO AS NU_DOCUMENTO_PARCELA
            FROM FINANCEIRO_PARCELA FP
            WHERE FP.DT_PAGAMENTO IS NULL
        ),
        parcelas_totais AS (
            SELECT
                ID_FINANCEIRO,
                SUM(VL_FINANCEIRO_PARCELA) AS VL_TOTAL_PARCELADO
            FROM FINANCEIRO_PARCELA
            GROUP BY ID_FINANCEIRO
        )
        SELECT
            F.ID_FINANCEIRO,
            F.DS_FINANCEIRO,
            F.NU_DOCUMENTO,
            F.VL_FINANCEIRO,
            P.ID_PESSOA,
            P.CD_PESSOA,
            P.NM_PESSOA,
            P.TP_PESSOA,
            P.CADASTRO,
            PA.DT_FINANCEIRO_PARCELA,
            PA.VL_FINANCEIRO_PARCELA,
            PA.NU_DOCUMENTO_PARCELA,
            COALESCE(PT.VL_TOTAL_PARCELADO, 0) AS VL_TOTAL_PARCELADO
        FROM FINANCEIRO F
            JOIN PESSOAS P ON P.ID_PESSOA = F.ID_PESSOA
            JOIN parcelas_abertas PA ON PA.ID_FINANCEIRO = F.ID_FINANCEIRO
            LEFT JOIN parcelas_totais PT ON PT.ID_FINANCEIRO = F.ID_FINANCEIRO
        WHERE F.ID_ENTIDADE = ? AND F.TP_FINANCEIRO = 'R'
        ORDER BY P.NM_PESSOA, PA.DT_FINANCEIRO_PARCELA
        `, [ID_ENTIDADE])

    // Agrupamento em JS: uma linha por pessoa (credor), com sub-linhas de parcela.
    // titulosVistos deduplica ID_FINANCEIRO para não contar o mesmo título mais de uma vez
    // ao somar Total do Título / Total Parcelado (o total de Parcelas em aberto NÃO precisa
    // dedup, porque cada linha da query já é uma parcela distinta).
    let hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    let credores = new Map()

    for (let r of rows) {
        if (!credores.has(r.ID_PESSOA)) {
            credores.set(r.ID_PESSOA, {
                CD_PESSOA: r.CD_PESSOA,
                NM_PESSOA: r.NM_PESSOA,
                TP_PESSOA: r.TP_PESSOA,
                CADASTRO: r.CADASTRO,
                parcelas: [],
                titulosVistos: new Set(),
                totalTitulo: 0,
                totalParcelado: 0,
                totalAberto: 0
            })
        }

        let credor = credores.get(r.ID_PESSOA)

        if (!credor.titulosVistos.has(r.ID_FINANCEIRO)) {
            credor.titulosVistos.add(r.ID_FINANCEIRO)
            credor.totalTitulo += Number(r.VL_FINANCEIRO)
            credor.totalParcelado += Number(r.VL_TOTAL_PARCELADO)
        }

        let vencida = new Date(r.DT_FINANCEIRO_PARCELA) < hoje

        credor.parcelas.push({
            vencimento: r.DT_FINANCEIRO_PARCELA,
            descricao: r.DS_FINANCEIRO + (r.NU_DOCUMENTO_PARCELA ? ' - Doc: ' + r.NU_DOCUMENTO_PARCELA : (r.NU_DOCUMENTO ? ' - Doc: ' + r.NU_DOCUMENTO : '')),
            valor: Number(r.VL_FINANCEIRO_PARCELA),
            vencida
        })

        credor.totalAberto += Number(r.VL_FINANCEIRO_PARCELA)
    }

    pdfmake.addFonts(fonts)

    // Cabeçalho 1: colunas do credor
    let content = [
        {
            columns: [
                { text: "Código", fontSize: 10, width:'10%', bold:true },
                { text: "Nome", fontSize: 10, width: '55%', bold:true },
                { text: "Tipo", fontSize: 10, width: '10%', bold:true },
                { text: "Cadastro", fontSize: 10, width: '25%', bold:true }
            ],
            margin: [0, 10, 0, 4]
        }
    ]

    for (let credor of credores.values()) {

        // Linha de dados do credor (segue o cabeçalho 1)
        content.push({
            columns: [
                { text: credor.CD_PESSOA, fontSize: 9, width:'10%', bold: true },
                { text: credor.NM_PESSOA, fontSize: 9, width: '55%', bold: true },
                { text: credor.TP_PESSOA == 'F' ? "Física" : "Jurídica", fontSize: 9, width: '10%', bold: true },
                { text: maskCpfCnpj(credor.CADASTRO), fontSize: 9, width: '25%', bold: true }
            ],
            margin: [0, 8, 0, 4]
        })
        content.push({canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#999999' }], margin: [0, 0, 0, 4]})

        // Cabeçalho 2: colunas da parcela (repetido por credor, é o detalhamento dele)
        content.push({
            columns: [
                { text: "Data Vencto", fontSize: 8, width:'15%', bold:true, italics: true },
                { text: "Descrição", fontSize: 8, width: '55%', bold:true, italics: true },
                { text: "Valor Parcela", fontSize: 8, width: '30%', bold:true, italics: true, alignment: 'right' }
            ],
            margin: [10, 0, 0, 3]
        })

        for (let p of credor.parcelas) {
            content.push({
                columns: [
                    { text: new Date(p.vencimento).toLocaleDateString('pt-BR'), fontSize: 8, width:'15%', color: p.vencida ? 'red' : '#000' },
                    { text: p.descricao, fontSize: 8, width: '55%', color: p.vencida ? 'red' : '#000' },
                    { text: maskCurrency(p.valor), fontSize: 8, width: '30%', alignment: 'right', color: p.vencida ? 'red' : '#000' }
                ],
                margin: [10, 2, 0, 2]
            })
        }

        content.push({canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 4, 0, 4]})

        // Rodapé do credor, colado à direita: Qtde. / Total / Parcelas / Diferença
        let diferenca = credor.totalTitulo - credor.totalParcelado
        let total = credor.totalAberto + diferenca

        content.push({
            columns: [
                { text: "Qtde. Parcelas: " + credor.parcelas.length, fontSize: 8, alignment: 'right' },
                { text: "Parcelas: " + maskCurrency(credor.totalAberto), fontSize: 8, alignment: 'right' },
                { text: "Diferença: " + maskCurrency(diferenca), fontSize: 8, alignment: 'right', color: Math.abs(diferenca) > 0.009 ? 'red' : '#000' },
                { text: "Total: " + maskCurrency(total), fontSize: 8, bold: true, alignment: 'right' },
            ],
            margin: [0, 0, 0, 12]
        })
    }

    let maker = pdfmake.createPdf({
        defaultStyle: { font: 'Helvetica' },
        pageSize: 'A4',
        pageMargins: [ 20, 100, 20, 20 ],

        header: function( ){ return{
            margin: [10, 10, 10, 10],
            columns: [
                {
                    image: entidade.ANEXO,
                    width: 80
                },
                {
                    stack: [
                        { text: entidade.DS_ENTIDADE, fontSize: 14, bold: true, margin: [20, 15, 20, 0] },
                        { text: "CPF/CNPJ: " + maskCpfCnpj(entidade.CNPJ), fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: entidade.DS_ENDERECO, fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: "Contas a Receber - Por Devedor", fontSize: 14, bold: true, margin: [20, 10, 20, 5], color: 'red'}

                    ],
                    alignment: 'right'
                },

            ]
        }},
        content: content
    })

    let report = 'data:application/pdf;base64,' + await maker.getBase64()

    return report
}

module.exports = {
    relatorio_contas_receber
}
