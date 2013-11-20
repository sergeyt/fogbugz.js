argv = require('optimist').argv
Q = require('q')
fb = require('./index')

methods = ['filters', 'projects', 'areas', 'milestones', 'categories', 'priorities', 'search']
reserved = ['email', 'pwd', 'password', '_', '$0'].concat(methods)

printAll = (_) -> [].slice.call(arguments, 0).forEach((x) -> console.log(JSON.stringify(x)))

p = fb({url: 'https://code.datadynamics.com', email: argv.email, password: argv.pwd || argv.password})
p.fail (err) -> console.log(err)
p.done (client) ->
	m = methods.filter((m) -> argv.hasOwnProperty(m))[0]
	args = Object.keys(argv).filter((k) -> reserved.indexOf(k) < 0).map((k) -> argv[k])
	client[m].apply(client, args).done(printAll)
