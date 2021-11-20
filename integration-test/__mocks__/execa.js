const execa = require('execa')

module.exports = (...args) => module.exports.execa(...args)
module.exports.execa = (...args) => console.log(args)
module.exports.realExeca = execa
