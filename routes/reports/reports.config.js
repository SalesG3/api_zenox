const pdfmake = require('pdfmake');

pdfmake.setUrlAccessPolicy(() => true)
pdfmake.setLocalAccessPolicy(() => true)

// Setando as fontes do relatório
const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
}

function maskCpfCnpj(valor) {
    const valorLimpo = valor.replace(/\D/g, '');

    if (valorLimpo.length <= 11) {
        return valorLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
        return valorLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

function maskCurrency(valor) {
    const numero = Number(valor) || 0; 
    
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(numero);
}

function maskCep(valor) {
    const valorLimpo = valor.replace(/\D/g, '').substring(0, 8);

    return valorLimpo
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function maskCell(valor) {
    if(!valor) return " - "
    const valorLimpo = valor.replace(/\D/g, '').substring(0, 11);

    return valorLimpo
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2');
}

module.exports = {
    pdfmake: pdfmake,
    fonts: fonts,
    maskCpfCnpj: maskCpfCnpj,
    maskCurrency: maskCurrency,
    maskCep: maskCep,
    maskCell: maskCell
}

