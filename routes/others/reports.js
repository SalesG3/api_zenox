const { app, con, jwt, map } = require('../../server')
const reports = require('../reports/report.index')

app.post('/reports/:report', async(req, res) => {

    let data = await reports[req.params.report](req)
    
    res.send({
        success: true,
        file: data
    })
})
