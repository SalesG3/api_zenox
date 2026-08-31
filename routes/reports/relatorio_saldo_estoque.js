const { app, con, jwt, map } = require("../../server")
const { pdfmake, fonts, maskCpfCnpj, maskCurrency, maskCep, maskCell } = require('./reports.config')

async function relatorio_saldo_estoque(req){

    let filters = req.body

    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE
    let [entidade] = (await con.promise().query('SELECT * FROM REPORT_ENTIDADE WHERE ID_ENTIDADE = ?', ID_ENTIDADE))[0]

    // CTEs (MySQL 8.0+): cada bloco calcula sua métrica isoladamente e é referenciado por nome.
    // Estoque (Entrada/Baixa) e Vendas continuam agregados SEPARADAMENTE antes do JOIN final —
    // juntar ESTOQUE_PRODUTO e VENDA_PRODUTO direto no mesmo SELECT infla as quantidades
    // (produto cartesiano), independente de usar CTE ou subquery.
    let [data] = await con.promise().query(`
        WITH estoque_agregado AS (
            SELECT
                EP.ID_PRODUTO,
                SUM(CASE WHEN E.TP_ESTOQUE = 'E' THEN EP.QT_ESTOQUE_PRODUTO ELSE 0 END) AS QT_ENTRADA,
                SUM(CASE WHEN E.TP_ESTOQUE = 'B' THEN EP.QT_ESTOQUE_PRODUTO ELSE 0 END) AS QT_BAIXA
            FROM ESTOQUE_PRODUTO EP
                JOIN ESTOQUE E ON E.ID_ESTOQUE = EP.ID_ESTOQUE
            GROUP BY EP.ID_PRODUTO
        ),
        vendas_agregado AS (
            SELECT
                VP.ID_PRODUTO,
                SUM(VP.QT_VENDA_PRODUTO) AS QT_VENDA
            FROM VENDA_PRODUTO VP
            GROUP BY VP.ID_PRODUTO
        )
        SELECT
            P.CD_PRODUTO,
            P.NM_PRODUTO,
            COALESCE(EST.QT_ENTRADA, 0) AS QT_ENTRADA,
            COALESCE(EST.QT_BAIXA, 0) AS QT_BAIXA,
            COALESCE(VEN.QT_VENDA, 0) AS QT_VENDA,
            (COALESCE(EST.QT_ENTRADA, 0) - COALESCE(EST.QT_BAIXA, 0) - COALESCE(VEN.QT_VENDA, 0)) AS QT_SALDO
        FROM PRODUTOS P
            LEFT JOIN estoque_agregado EST ON EST.ID_PRODUTO = P.ID_PRODUTO
            LEFT JOIN vendas_agregado VEN ON VEN.ID_PRODUTO = P.ID_PRODUTO
        WHERE P.ID_ENTIDADE = ? AND P.SN_ATIVO = ${filters.SN_ATIVO}
        ORDER BY P.NM_PRODUTO
        `, [ID_ENTIDADE])

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
                        { text: "CPF/CNPJ: " + maskCpfCnpj(entidade.CNPJ), fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: entidade.DS_ENDERECO, fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: "Relatório de Saldo de Estoque", fontSize: 14, bold: true, margin: [20, 10, 20, 5], color: 'red'}

                    ],
                    alignment: 'right'
                },

            ]
        }},
        content: [
            {
                columns: [
                    { text: "Código", fontSize: 10, width:'9%', bold:true },
                    { text: "Produto", fontSize: 10, width: '31%', bold:true  },
                    { text: "Entradas", fontSize: 10, width: '15%', bold:true, alignment: 'right' },
                    { text: "Baixas", fontSize: 10, width: '15%', bold:true, alignment: 'right' },
                    { text: "Vendas", fontSize: 10, width: '15%', bold:true, alignment: 'right' },
                    { text: "Saldo", fontSize: 10, width: '15%', bold:true, alignment: 'right' }
                ],
                margin: [0, 7, 0, 0]
            },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 5]},
            ...data.map(i => { return[{
                columns: [
                    { text: i.CD_PRODUTO, fontSize: 9, width:'9%' },
                    { text: i.NM_PRODUTO, fontSize: 9, width: '31%' },
                    { text: Number(i.QT_ENTRADA).toLocaleString('pt-BR', {minimumFractionDigits: 3}), fontSize: 9, width: '15%', alignment: 'right' },
                    { text: Number(i.QT_BAIXA).toLocaleString('pt-BR', {minimumFractionDigits: 3}), fontSize: 9, width: '15%', alignment: 'right' },
                    { text: Number(i.QT_VENDA).toLocaleString('pt-BR', {minimumFractionDigits: 3}), fontSize: 9, width: '15%', alignment: 'right' },
                    { text: Number(i.QT_SALDO).toLocaleString('pt-BR', {minimumFractionDigits: 3}), fontSize: 9, width: '15%', bold: true, alignment: 'right' },
                ],
                margin: [0, 2, 0, 3]
            }, {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 2]},
            ]})
        ]
    })

    let report = 'data:application/pdf;base64,' + await maker.getBase64()

    return report
}

module.exports = {
    relatorio_saldo_estoque
}
