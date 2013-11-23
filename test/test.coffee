argv = require('optimist').argv
Q = require('q')
fb = require('../index')

methods = [
		'filters', 'projects', 'areas', 'milestones',
		'categories', 'priorities', 'search', 'events'
	]

reserved = ['email', 'pwd', 'password', '_', '$0'].concat(methods)

printJson = (x) -> console.log(JSON.stringify(x, null, 2))
printError = (err) -> console.log(err)
printAll = (_) -> [].slice.call(arguments, 0).forEach(printJson)

p = fb
			url: 'https://code.datadynamics.com',
			email: argv.email,
			password: argv.pwd || argv.password

p.fail printError
p.done (client) ->
	console.log('token:%s', client.token)
	m = methods.filter((m) -> argv.hasOwnProperty(m))[0]
	args = Object.keys(argv).filter((k) -> reserved.indexOf(k) < 0).map((k) -> argv[k])
	client[m].apply(client, args).done(printAll)
