const { app, con, jwt, map } = require("../../server")
const { pdfmake, fonts, maskCpfCnpj, maskCurrency, maskCep, maskCell } = require('./reports.config')

async function ordemservico(req){
    let filters = req.body

    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE
    let [entidade] = (await con.promise().query('SELECT * FROM REPORT_ENTIDADE WHERE ID_ENTIDADE = ?', ID_ENTIDADE))[0]

    let [OS] = (await con.promise().query(`
        SELECT
	        P.NM_PESSOA,
            P.CADASTRO,
            CONCAT(
                P.END_LOGRADOURO, ', ' ,
                P.END_NUMERO, ', ' ,
                P.END_BAIRRO, ' - ' ,
                CI.NM_CIDADE
            ) AS END_ENDERECO,
            P.END_CEP,
            P.CON_CELULAR,
            P.CON_TELEFONE,
            P.CON_EMAIL,
            M.*,
            SUM(IF(TP_PRODUTO = 'S', VL_TOTAL, 0)) AS VL_SERVICO,
            SUM(IF(TP_PRODUTO IN ('P','R'), VL_TOTAL, 0)) AS VL_PRODUTO
        FROM MOVIMENTACOES M
	        INNER JOIN PESSOAS P ON M.ID_PESSOA = P.ID_PESSOA
            INNER JOIN MOVIMENTACOES_ITENS MI ON M.ID_MOVIMENTACAO = MI.ID_MOVIMENTACAO
            INNER JOIN PRODUTOS PR ON MI.ID_PRODUTO = PR.ID_PRODUTO
            LEFT  JOIN CIDADES CI ON CI.ID_CIDADE = P.ID_CIDADE
        WHERE M.ID_MOVIMENTACAO = ${filters.ID_MOVIMENTACAO}
        GROUP BY 1, 2, 3`))[0]

    let [ITENS] = (await con.promise().query(`
        SELECT
	        CASE TP_PRODUTO
		        WHEN 'S' THEN 'Serviço'
                WHEN 'P' THEN 'Produto'
                WHEN 'R' THEN 'Produto'
            END AS TP_PRODUTO,
            P.NM_PRODUTO,
            P.UN_MEDIDA,
            MI.QT_ITENS,
            MI.VL_UNITARIO,
            MI.VL_TOTAL
        FROM MOVIMENTACOES_ITENS MI
            INNER JOIN PRODUTOS P ON MI.ID_PRODUTO = P.ID_PRODUTO
        WHERE ID_MOVIMENTACAO = ${filters.ID_MOVIMENTACAO};`))

    pdfmake.addFonts(fonts)

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
                        { text: "CNPJ: " + maskCpfCnpj(entidade.CNPJ), fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: entidade.DS_ENDERECO, fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: "Ordem de Serviço - Nº " + OS.CD_MOVIMENTACAO, fontSize: 14, bold: true, margin: [20, 10, 20, 5], color: 'red'}
                        
                    ],
                    alignment: 'right'
                },
                
            ]
        }},
        content: [
            { text: "Dados do Cliente:", fontSize: 12, bold: true, margin: [0, 20, 0, 0] },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 0]},
            {
                columns: [
                    { text: "Nome: " + OS.NM_PESSOA, fontSize: 10, width: '66%' },
                    { text: "CPF/CNPJ: " + maskCpfCnpj(OS.CADASTRO), fontSize: 10, width: '33%' },
                ],
                margin: [0, 10, 0, 0]
            },
            {
                columns: [
                    { text: "Endereço: " + OS.END_ENDERECO, fontSize: 10, width: '66%' },
                    { text: "CEP: " + maskCep(OS.END_CEP), fontSize: 10, width: '33%' }
                ],
                margin: [0, 7, 0, 0]
            },
            {
                columns: [
                    { text: "Email: " + (OS.CON_EMAIL || " - "), fontSize: 10, width: '50%' },
                    { text: "Celular: " + maskCell(OS.CON_CELULAR), fontSize: 10, width: '25%' },
                    { text: "Telefone: " + maskCell(OS.CON_TELEFONE), fontSize: 10, width: '25%' }
                ],
                margin: [0, 7, 0, 0]
            },

            { text: "Itens da Ordem de Serviço:", fontSize: 12, bold: true, margin: [0, 20, 0, 0] },
            { text: "Descrição: " + OS.DS_MOVIMENTACAO, fontSize: 10, margin: [0, 7, 0, 0]},
            {
                columns: [
                    { text: "Tipo", fontSize: 10, width:'10%' },
                    { text: "Produto/Serviço", fontSize: 10, width: '40%' },
                    { text: "Medida", fontSize: 10, width: '10%' },
                    { text: "Qtde.", fontSize: 10, width: '10%' },
                    { text: "Vl. Unitário", fontSize: 10, width: '15%' },
                    { text: "Vl. Total", fontSize: 10, width: '15%' }
                ],
                margin: [0, 7, 0, 0]
            },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 5]},

            ...ITENS.map(i => { return{
                columns: [
                    { text: i.TP_PRODUTO, fontSize: 9, width:'10%' },
                    { text: i.NM_PRODUTO, fontSize: 9, width: '40%' },
                    { text: i.UN_MEDIDA, fontSize: 9, width: '10%' },
                    { text: i.QT_ITENS, fontSize: 9, width: '10%' },
                    { text: maskCurrency(i.VL_UNITARIO), fontSize: 9, width: '15%' },
                    { text: maskCurrency(i.VL_TOTAL), fontSize: 9, width: '15%' }
                ],
                margin: [0, 2, 0, 3]
            }}),
            {
                columns: [
                    { text: "Total de Itens: " + ITENS.length, fontSize: 10, bold: true },
                    { text: "Valor Total: " + maskCurrency(OS.VL_MOVIMENTACAO), fontSize: 10, bold: true, margin: [138, 0, 0, 0]}
                ],
                margin: [0, 5, 0, 0]
            },
            { text: "Diagnóstico / Observações:", fontSize: 12, bold: true, margin: [0, 20, 0, 0] },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 0]},
            {
                text: OS.HISTORICO, fontSize: 10, margin: [0, 10, 0, 0]
            },

            { text: "Total Geral:", fontSize: 12, bold: true, margin: [0, 20, 0, 0] },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 0]},
            {
                columns: [
                    { text: "Total de Serviços", fontSize: 10 },
                    { text: "Total de Produtos", fontSize: 10 },
                    { text: "Valor Desconto", fontSize: 10 },
                    { text: "Total Líquido", fontSize: 10 }
                ],
                margin: [0, 5, 0, 0]
            },
            {
                columns: [
                    { text: maskCurrency(OS.VL_SERVICO), fontSize: 10 },
                    { text: maskCurrency(OS.VL_PRODUTO), fontSize: 10 },
                    { text: maskCurrency(OS.VL_DESCONTO), fontSize: 10 },
                    { text: maskCurrency(OS.VL_MOVIMENTACAO - OS.VL_DESCONTO), fontSize: 10 }
                ],
                margin: [0, 5, 0, 0]
            }
        ],
        footer: function(){
            let dateTime = new Date().toLocaleString()

            return{
                margin: [10, -50, 10, 10],
                stack: [
                    {
                        columns: [
                            {
                                canvas:[{
                                    type: 'line',
                                    x1: 0, y1: 0,
                                    x2: 200, y2: 0,
                                    lineWidth: .5,
                                    lineColor: '#000000'
                                }], margin: [0, 2, 0, 0], alignment: 'center'
                            },
                            {
                                canvas: [{
                                    type: 'line', x1: 0, y1: 0,
                                    x2: 200, y2: 0,
                                    lineWidth: .5,
                                    lineColor: '#000000'
                                }], margin: [0, 2, 0, 0], alignment: 'center'
                            },
                            
                        ]
                    },
                    {
                        columns: [
                            {
                                text: OS.NM_PESSOA,
                                fontSize: 10
                                
                            },
                            {
                                text: entidade.DS_ENTIDADE,
                                fontSize: 10
                            }
                        ], margin: [0, 3, 0, 0], alignment: 'center'
                    },
                    {
                        columns: [
                            {
                                text: maskCpfCnpj(OS.CADASTRO),
                                fontSize: 10
                                
                            },
                            {
                                text: maskCpfCnpj(entidade.CNPJ),
                                fontSize: 10
                            }
                        ], margin: [0, 3, 0, 0], alignment: 'center'
                    },
                    {
                        text: dateTime,
                        fontSize: 8,
                        alignment: 'right',
                        margin: [0, 30, 10, 0]
                    }
                ]
        }}
    })

    let data = 'data:application/pdf;base64,' + await maker.getBase64()

    return data
}

module.exports = {
    ordemservico
}