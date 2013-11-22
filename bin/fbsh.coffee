fs = require('fs')
fogbugz = require('../index')
read = require('read')
askfor = require('askfor')
Table = require('cli-table')

help = ->
    console.log 'commands:'
    console.log '  ls                            - list active cases from current filter'
    console.log '  ls f                          - list available filters'
    console.log '  ls p                          - list available projects'
    console.log '  ls m                          - list available milestones'
    console.log '  ls u                          - list available users'
    console.log '  search q                      - searches cases by specified q'
    console.log '  take #case [comment]          - assign given case to logon user'
    console.log '  resolve [#case] [comment]     - resolves current or given case with optional comment'
    console.log '  assign #case userId [comment] - assign given case to given user with optional comment'
    console.log '  log [#case] [comment]         - logs specified comment to given or current case'
    done

# instance of fogbugz client
fb = null
currentCase = null
fcall = (f) -> f()
# promise duck
done =
    then: fcall
    done: fcall
    fail: fcall

main = -> auth repl
repl = -> read {prompt: 'fbsh> '}, (err, l) -> printError(run(l)).done(repl)

# evals specified line
run = (l) ->
    args = l.split(' ').filter((w) -> !!w)
    cmd = args[0]
    switch cmd
        when 'help' then do help
        when 'ls' then ls args
        when 'q' then process.exit 0
        when 'search' then search args
        when 'take' then take args
        when 'resolve' then resolve args
        when 'assign' then assign args
        when 'log' then log args
        else
            console.log 'unknown command: %s', cmd
            done

# CONFIG
cfgfile = __dirname + '/fbsh.conf.json'

auth = (cb) ->
    if fs.existsSync cfgfile
        options = require(cfgfile)
        # TODO check token
        if options.token
            start options, false, cb
        else
            askcfg cb
    else
        askcfg cb

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

ls = (args) ->
    switch args[1]
        when 'f'
            fb.filters().then printTable
        when 'p'
            fb.projects().then printProjects
        when 'u'
            fb.people().then printUsers
        when 'm'
            fb.milestones().then printMilestones
        else
            fb.search()
              .then(filterActiveCases)
              .then printCases

# TODO do not hardcode active status
filterActiveCases = (list) -> list.filter (x) -> x.status.id == 1

search = (args) ->
    # TODO intelligent search
    fb.search(args[2]).then(printCases)

take = (args) ->
    fb.take(args[2], args[3]).then -> currentCase = args[2]

resolve = (args) ->
    cid = parseInt(args[2], 10)
    comment = args[3] || ''
    if isNaN cid
        comment = args[2]
        if !currentCase then return error('no taken case')
        cid = currentCase
    fb.resolve cid, comment

assign = (args) ->
    cid = parseInt(args[2])
    if isNaN cid then return error('expected case number')
    fb.assign args[2], args[3], args[4]

log = (args) ->
    cid = parseInt(args[2], 10)
    comment = args[3] || ''
    if isNaN cid
        comment = args[2]
        if !currentCase then return error('no taken case')
        cid = currentCase
    fb.log cid, comment

# utils
isfn = (x) -> typeof x == 'function'
toJson = (x) -> JSON.stringify x, null, 2
printJson = -> [].slice.call(arguments, 0).forEach((x) -> console.log(toJson x))
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
    table = new Table({
        head: ['#', 'assignee', 'title'],
        colWidths: [8, 15, 85]
    })
    table.push.apply table, list.map (x) -> [x.id || 0, shortUserName(x.assignee), x.title || '']
    console.log table.toString()

shortUserName = (user) ->
    if !user || !user.name then return ''
    arr = user.name.split(' ')
    if arr.length <= 1 then user.name else arr[0] + arr[1].substr(0, 1)

do main