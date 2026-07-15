const { app, con, jwt, map } = require('../../server')
const lookups = require('../../querys/lookups')
const filters = require('../../querys/filters')

// ROTA PARA LOOKUP'S DINÂMICOS

app.get('/lookup/:query', async(req, res) => {

    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE

    let dataSQL = lookups[req.params.query](ID_ENTIDADE)

    let [dataRes] = await con.promise().query(dataSQL)

    res.send(dataRes)
})

// ROTA PARA LOOKUP'S DE FILTRO DE RELATÓRIOS

app.get('/filters/:query', async(req, res) => {
    
    let ID_ENTIDADE = jwt.verify(req.headers.x_session, process.env.XKEY).ID_ENTIDADE

    let dataSQL = filters[req.params.query](ID_ENTIDADE)

    let [dataRes] = await con.promise().query(dataSQL)

    res.send(dataRes)
})