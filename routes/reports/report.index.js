const { relatorio_saldo_estoque } = require("./relatorio_saldo_estoque")
const { relatorio_contas_pagar } = require("./relatorio_contas_pagar")
const { relatorio_contas_receber } = require("./relatorio_contas_receber")

module.exports = {
    relatorio_saldo_estoque,
    relatorio_contas_pagar,
    relatorio_contas_receber
}