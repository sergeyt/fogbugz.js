argv = require('optimist').argv
Q = require('q')
fb = require('./index')

printAll = (_) -> [].slice.call(arguments, 0).forEach((x) -> console.log(JSON.stringify(x)))

p = fb({url: 'https://code.datadynamics.com', email: argv.email, password: argv.pwd || argv.password})
p.fail (err) -> console.log(err)

p.done (client) -> Q.all(client.milestones()).done(printAll)
#p.done (client) -> Q.all(client.filters(), client.projects(), client.areas(), client.categories(), client.priorities(), client.milestones()).done(printAll)
