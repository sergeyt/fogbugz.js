fs = require('fs')
fogbugz = require('../index')
read = require('read')
askfor = require('askfor')
Table = require('cli-table')
memo = require('memoizee')
iz = require('iz')

fcall = (f) -> f()
# promise duck
done =
	then: fcall
	done: fcall
	fail: fcall

# instance of fogbugz client
fb = null
currentCase = null
lastCases = []

help = ->
	cmds =
		[
			['ls', 'list active cases from current filter'],
			['ls f', 'list available filters'],
			['ls p', 'list available projects'],
			['ls m', 'list available milestones']
			['ls u', 'list available users'],
			['search q', 'searches cases by specified q'],
			['take #case [comment]', 'assign given case to logon user'],
			['resolve [#case] [comment]', 'resolves current or given case']
			['assign #case userId [comment]', 'assign given case to given user'],
			['log [#case] [comment]', 'logs specified comment to given case'],
			['q[uit]', 'exit from this shell'],
			['exit', 'exit from this shell'],
		]
	console.log 'commands:'
	col = Math.max.apply(null, cmds.map (x) -> x[0].length)
	list = cmds.map (x) -> '  ' + padr(x[0], col) + ' - ' + x[1]
	list.forEach (s) -> console.log(s)
	done

padr = (s,len) -> s + Array(len-s.length).join ' '

repl = -> read {prompt: '>>> '}, (err, l) -> printError(run(l)).done(repl)

# evals specified line
run = (l) ->
	args = []
	rx = /('[^']*')|("[^"]*")|(\w|\d)+/g
	while (m = rx.exec(l)) != null
		args.push unquote m[0]
	cmd = args[0]
	switch cmd
		when 'help' then do help
		when 'ls' then ls args
		when 'q' then process.exit 0
		when 'quit' then process.exit 0
		when 'exit' then process.exit 0
		when 'search' then search args
		when 'take' then take args
		when 'resolve' then resolve args
		when 'assign' then assign args
		when 'log' then log args
		else unkcmd cmd

unquote = (s) -> if s[0] == '"' or s[0] == "'" then s.substr 1, s.length - 2 else s
unkcmd = (cmd) ->
	console.log 'unknown command: %s', cmd
	done

# CONFIG
cfgfile = __dirname + '/fbsh.conf.json'

auth = (cb) ->
	if fs.existsSync cfgfile
		options = require(cfgfile)
		# TODO check token
		if options.token then start options, false, cb else askcfg cb
	else askcfg cb

askcfg = (cb) ->
	askfor ['fogbugz url', 'user', 'password'], (answers) ->
		options =
			url: answers['fogbugz url']
			user: answers.user,
			password: answers.password
		start options, true, cb

start = (options, updateConfig, cb) ->
	p = fogbugz(options)
	p.fail (error) ->
		console.log(error)
		# TODO auth again
		process.exit(-1)
	p.done (client) ->
		if updateConfig
			delete options.password
			options.token = client.token
			fs.writeFileSync(cfgfile, toJson(options), 'utf8')
		fb = client
		cb()

# list command handler
ls = (args) ->
	switch args[1]
		when 'f' then filters().then printTable
		when 'p' then projects().then printProjects
		when 'u' then users().then printUsers
		when 'm' then milestones().then printMilestones
		else
			id = if args[1] then parseInt(args[1], 10) else NaN
			if isNaN id
					listActiveCases()
			else
					caseObj = lastCases.filter((x) -> x.id == id)[0]
					if caseObj then caseObj.events().then printEvents else done

# returns memoized Fb method
fbmemo = (method) ->
		fn = null
		->
			if fn == null
				fn = memo(fb[method])
			fn.apply fb, [].slice.call(arguments)

filters = fbmemo('filters')
projects = fbmemo('projects')
users = fbmemo('people')
milestones = fbmemo('milestones')

listActiveCases = ->
	fb.search()
		.then(filterActiveCases)
		.then((list) -> lastCases = list)
		.then printCases

# TODO do not hardcode active status
filterActiveCases = (list) -> list.filter (x) -> x.status.id == 1

# search command handler
search = (args) ->
	# TODO intelligent search
	fb.search(args[2]).then(printCases)

# take command handler
take = (args) ->
	fb.take(args[1], args[2]).then -> currentCase = args[1]

# resolve command handler
resolve = (args) ->
	cid = parseInt(args[2], 10)
	comment = args[3] || ''
	if isNaN cid
		comment = args[2]
		if !currentCase then return error('no taken case')
		cid = currentCase
	fb.resolve cid, comment

# assign command handler
assign = (args) ->
	cid = parseInt(args[1])
	if isNaN cid then return error('expected case number')
	resolveUser(args[2]).then (u) ->
		fb.assign cid, u.id, args[3]

resolveUser = (id) ->
	if !id then return error('user id is not specified');
	users().then (list) ->
		if iz.email(id) then return (list.filter (u) -> u.email == id)[0]
		if iz.int(id) then return (list.filter (u) -> u.id == id)[0]
		id = id.toLowerCase()
		(list.filter (u) -> u.name.toLowerCase() == id || shortName(u).toLowerCase() == id)[0]

# log command impl
log = (args) ->
	cid = parseInt(args[1], 10)
	comment = args[2] || ''
	if isNaN cid
		comment = args[1]
		if !currentCase then return error('no taken case')
		cid = currentCase
	fb.log cid, comment

# utils
isfn = (x) -> typeof x == 'function'
toJson = (x) -> JSON.stringify x, null, 2
printJson = -> [].slice.call(arguments, 0).forEach (x) -> console.log(toJson x)
printError = (promise) ->
	promise.fail error
	promise

error = (msg) ->
	console.log msg
	done

unwrap = (x) -> if x.id && x.name then x.name else x

printTable = (list, keys) ->
	if list.length == 0 then return done
	head = (keys || Object.keys(list[0])).filter (x) -> !isfn list[0][x]
	table = new Table({head: head})
	table.push.apply table, list.map (x) -> head.map (k) -> unwrap x[k]
	console.log table.toString()

printProjects = (list) -> printTable list, ['id', 'name', 'email', 'owner']
printMilestones = (list) -> printTable list, ['id', 'name', 'project']
printUsers = (list) -> printTable list, ['id', 'name', 'email']

printCases = (list) ->
	if list.length == 0 then return done
	table = new Table
		head: ['#', 'assignee', 'title', 'tags'],
		colWidths: [8, 15, 85, 10]
	table.push.apply table, list.map (x) -> [
		x.id || 0,
		shortName(x.assignee),
		x.title || '',
		(x.tags || []).join(', ')
	]
	console.log table.toString()

printEvents = (list) ->
	list.forEach (e) ->
		console.log.apply(console, [
			'%s %s: %s',
			shortName(e.person),
			relTime(e.date),
			(e.text || e.description)
		])

shortName = (user) ->
	if !user || !user.name then return ''
	arr = user.name.split(' ')
	if arr[0].length <= 2 then return user.name
	if arr.length <= 1 then user.name else arr[0] + arr[1].substr(0, 1)

relTime = (d) ->
	now = new Date()
	if d.getDate() == now.getDate() then return 'today'
	if d.getDate() == now.getDate() - 1 then return 'yesterday'
	dif = now.getDate() - d.getDate()
	return dif + ' days ago'

main = -> auth repl
do main