const { app, con, jwt, map } = require("../../server")
const { pdfmake, fonts, maskCpfCnpj, maskCurrency, maskCep, maskCell } = require('./reports.config')

async function listagem_pessoas(req){
    
    let filters = req.body

    let TP_PESSOA = filters.TP_PESSOA ? `AND TP_PESSOA = '${filters.TP_PESSOA}'` : ""

    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE
    let [entidade] = (await con.promise().query('SELECT * FROM REPORT_ENTIDADE WHERE ID_ENTIDADE = ?', ID_ENTIDADE))[0]

    let [data] = await con.promise().query(`
        SELECT
            *
        FROM PESSOAS P
            WHERE ID_ENTIDADE = ? AND SN_ATIVO = ${filters.SN_ATIVO} ${TP_PESSOA}
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
                        { text: "CNPJ: " + maskCpfCnpj(entidade.CNPJ), fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: entidade.DS_ENDERECO, fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: "Listagem de Credores & Responsáveis", fontSize: 14, bold: true, margin: [20, 10, 20, 5], color: 'red'}
                        
                    ],
                    alignment: 'right'
                },
                
            ]
        }},
        content: [
            {
                columns: [
                    { text: "Código", fontSize: 10, width:'10%', bold:true },
                    { text: "Tipo", fontSize: 10, width: '20%', bold:true  },
                    { text: "Nome", fontSize: 10, width: '40%', bold:true  },
                    { text: "CPF/CNPJ", fontSize: 10, width: '20%', bold:true  },
                    { text: "Ativo", fontSize: 10, width: '10%', bold:true  }
                ],
                margin: [0, 7, 0, 0]
            },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 5]},
            ...data.map(i => { return[{
                columns: [
                    { text: i.CD_PESSOA, fontSize: 9, width:'10%' },
                    { text: i.TP_PESSOA == 'F' ? "Física" : "Jurídica", fontSize: 9, width: '20%' },
                    { text: i.NM_PESSOA, fontSize: 9, width: '40%' },
                    { text: maskCpfCnpj(i.CADASTRO), fontSize: 9, width: '20%' },
                    { text: i.SN_ATIVO ? "Sim" : "Não", fontSize: 9, width: '10%' },
                ],
                margin: [0, 2, 0, 3]
            }, {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 2]},
            ]})
        ]
    })

    let report = 'data:application/pdf;base64,' + await maker.getBase64()

    return report
}

async function listagem_categorias(req){
    
    let filters = req.body


    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE
    let [entidade] = (await con.promise().query('SELECT * FROM REPORT_ENTIDADE WHERE ID_ENTIDADE = ?', ID_ENTIDADE))[0]

    let [data] = await con.promise().query(`
        SELECT
            CD_CATEGORIA,
            CASE TP_CATEGORIA
                WHEN 'F' THEN 'Financeiro'
                WHEN 'E' THEN 'Estoque'
                WHEN 'M' THEN 'OS/Venda'
                WHEN 'P' THEN 'Produto'
            END AS TP_CATEGORIA,
            NM_CATEGORIA,
            SN_ATIVO
        FROM CATEGORIAS C
            WHERE ID_ENTIDADE = ? AND SN_ATIVO = ${filters.SN_ATIVO}
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
                        { text: "CNPJ: " + maskCpfCnpj(entidade.CNPJ), fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: entidade.DS_ENDERECO, fontSize: 9, color: '#444', margin: [20, 5, 20, 0] },
                        { text: "Listagem de Cateogiras", fontSize: 14, bold: true, margin: [20, 10, 20, 5], color: 'red'}
                        
                    ],
                    alignment: 'right'
                },
                
            ]
        }},
        content: [
            {
                columns: [
                    { text: "Código", fontSize: 10, width:'10%', bold:true },
                    { text: "Tipo", fontSize: 10, width: '25%', bold:true  },
                    { text: "Categoria", fontSize: 10, width: '55%', bold:true  },
                    { text: "Ativo", fontSize: 10, width: '10%', bold:true  }
                ],
                margin: [0, 7, 0, 0]
            },
            {canvas: [{type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 2, 0, 5]},
            ...data.map(i => { return[{
                columns: [
                    { text: i.CD_CATEGORIA, fontSize: 9, width:'10%' },
                    { text: i.TP_CATEGORIA, fontSize: 9, width: '25%' },
                    { text: i.NM_CATEGORIA, fontSize: 9, width: '55%' },
                    { text: i.SN_ATIVO ? "Sim" : "Não", fontSize: 9, width: '10%' },
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
    listagem_pessoas,
    listagem_categorias
}