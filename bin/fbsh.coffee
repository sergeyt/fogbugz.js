fs = require('fs')
fogbugz = require('../fogbugz')
read = require('read')
askfor = require('askfor')
Table = require('cli-table')
memo = require('memoizee')
iz = require('iz')
Q = require('q')
print = require('node-more')

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
			['ls c', 'list available case categories'],
			['ls s', 'list available case statuses'],
			['ls l', 'list available priorities'],
			['ps', 'list available projects'],
			['ms', 'list available milestones'],
			['us', 'list available users'],
			['u id', 'print user info'],
			['search q', 'searches cases by specified q'],
			['take #case [comment]', 'assign given case to logon user'],
			['resolve [#case] [comment]', 'resolves current or given case']
			['close #case [comment]', 'close given case'],
			['reopen #case [comment]', 'reopen given case'],
			['assign #case userId [comment]', 'assign given case to given user'],
			['kick #case [comment]', 'return given case back to team'],
			['log [#case] [comment]', 'logs specified comment to given case'],
			['q[uit]', 'exit from this shell'],
			['exit', 'exit from this shell'],
			['help', 'print this command list'],
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
		when 'ps' then projects().then printProjects
		when 'ms' then ms args
		when 'us' then users().then printUsers
		when 'search' then search args
		when 'take' then take args
		when 'resolve' then resolve args
		when 'assign' then assign args
		when 'close' then close args
		when 'reopen' then reopen args
		when 'kick' then kick args
		when 'log' then log args
		when 'u' then resolveUser(args[1]).then((x) -> [x]).then(printUsers)
		when 'q' then process.exit 0
		when 'quit' then process.exit 0
		when 'exit' then process.exit 0
		else unkcmd cmd

unquote = (s) ->
	if s[0] == '"' or s[0] == "'" then s.substr 1, s.length - 2 else s
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

# returns memoized Fb method
fbmemo = (method) ->
	fn = null
	->
		fn = memo(fb[method]) unless fn != null
		fn.apply fb, [].slice.call(arguments)

filters = fbmemo('filters')
projects = fbmemo('projects')
users = fbmemo('people')
milestones = fbmemo('milestones')
categories = fbmemo('categories')
statuses = fbmemo('statuses')
priorities = fbmemo('priorities')

# list command handler
ls = (args) ->
	switch args[1]
		when 'f' then filters().then printTable
		when 'p' then projects().then printProjects
		when 'u' then users().then printUsers
		when 'm' then milestones().then printMilestones
		when 'c' then categories().then printTable
		when 's' then statuses().then printTable
		when 'l' then priorities().then printTable
		else
			id = if args[1] then parseInt(args[1], 10) else NaN
			if isNaN id
					listActiveCases()
			else
					caseObj = lastCases.filter((x) -> x.id == id)[0]
					if caseObj then caseObj.events().then printEvents else done

listActiveCases = ->
	fb.search()
		.then(filterActiveCases)
		.then((list) -> lastCases = list)
		.then printCases

# TODO do not hardcode active status
filterActiveCases = (list) -> list.filter (x) -> x.status.id == 1

# listing milestone
ms = (args) ->
	if args.length >= 2
		return resolveMilestone(args[1]).then (m) -> m.cases().then(printCases)
	return milestones().then printMilestones

resolveMilestone = (id) ->
	n = parseInt(id, 10)
	return milestones().then (list) ->
		f = list.filter (m) -> m.id == n || m.name == id
		return fb.milestone f[0] if f.length == 1
		return {cases: -> Q []}

# search command handler
search = (args) ->
	# TODO intelligent search
	fb.search(args[2]).then(printCases)

workflowFile = __dirname + '/workflow.json'
workflow = ->
	return require workflowFile if fs.existsSync workflowFile
	return {}

# take command handler
take = (args) ->
	fb.take(args[1], args[2]).then -> currentCase = args[1]

parseArgs1 = (args) ->
	id = parseInt(args[1], 10)
	comment = args[2] || ''
	if isNaN id
		comment = args[1]
		return Q.reject('no taken case') if !currentCase
		id = currentCase
	return Q({id: id, comment: comment})

# resolve command handler
resolve = (args) ->
	parseArgs1(args).then (c) ->
		wf = workflow()
		if not wf.resolve then return Q.reject('no resolve workflow')
		fb.resolve
			id: c.id
			comment: c.comment
			status: wf.resolve.status
			user: wf.resolve.user

# close command handler
close = (args) ->
	parseArgs1(args).then (c) ->
		fb.close c.id, c.comment

# reopen command handler
reopen = (args) ->
	fb.close args[1], args[2]

# assign command handler
assign = (args) ->
	cid = parseInt(args[1])
	return error('expected case number') if isNaN cid
	resolveUser(args[2]).then (u) ->
		fb.assign cid, u.id, args[3]

# kick command handler
kick = (args) ->
	parseArgs1(args).then (c) ->
		wf = workflow()
		resolveUser(wf.kick).then (u) ->
			fb.assign c.id, u.id, c.comment

resolveUser = (id) ->
	if !id then return error('user id is not specified')
	users().then (list) ->
		return (list.filter (u) -> u.email.indexOf(id) >= 0)[0] if iz.email(id)
		return (list.filter (u) -> u.id == id)[0] if iz.int(id)
		id = id.toLowerCase()
		return (list.filter (u) ->
			u.name.toLowerCase() == id || shortName(u).toLowerCase() == id)[0]

# log command impl
log = (args) ->
	parseArgs1(args).then (c) ->
		fb.log c.id, c.comment

# utils
isfn = (x) -> typeof x == 'function'
toJson = (x) -> JSON.stringify x, null, 2

printJson = -> [].slice.call(arguments, 0).forEach (x) -> print(toJson x)
printError = (promise) ->
	promise.fail error
	promise

error = (msg) ->
	console.log msg
	done

unwrap = (x) ->
	if x.id && x.name then x.name
	else if typeof x is 'string' then x else JSON.stringify(x)

printTable = (list, keys) ->
	list = list.filter (x) -> x != null and x != undefined
	if list.length == 0 then return done
	head = (keys || Object.keys(list[0])).filter (x) -> !isfn list[0][x]
	table = new Table({head: head})
	table.push.apply table, list.map (x) -> head.map (k) -> unwrap x[k]
	print table.toString()

printProjects = (list) -> printTable list, ['id', 'name', 'email', 'owner']
printMilestones = (list) -> printTable list, ['id', 'name', 'project']
printUsers = (list) -> printTable list, ['id', 'name', 'email']

printCases = (list) ->
	if list.length == 0 then return done
	table = new Table
		head: ['#', 'assignee', 'title', 'tags'],
		colWidths: [8, 10, 80, 10]
	table.push.apply table, list.map (x) -> [
		x.id || 0,
		shortName(x.assignee),
		x.title || '',
		(x.tags || []).join(', ')
	]
	print table.toString()

printEvents = (list) ->
	lines = list.map (e) ->
		shortName(e.person) + ' ' +
		ago(e.date) + ': ' +
		(e.text || e.description)
	print lines.join '\n'

shortName = (user) ->
	return '' if !user || !user.name
	arr = user.name.split(' ')
	return user.name if arr.length <= 1 || arr[0].length <= 2
	return arr[0] + arr[1].substr(0, 1)

ago = (d) -> require('pretty-date').format(d)

# run the shell
auth repl