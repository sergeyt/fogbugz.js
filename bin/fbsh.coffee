fs = require('fs')
fogbugz = require('../index')
read = require('read')
askfor = require('askfor')
Table = require('cli-table')

# instance of fogbugz client
fb = null
# promise duck
done = {done: (cb) -> cb()}

main = () -> auth repl
repl = () -> read {prompt: 'fbsh> '}, (err, l) -> run(l).done(repl)

# runs specified line
run = (l) ->
    args = l.split(' ').filter((w) -> !!w)
    cmd = args[0]
    switch cmd
        when 'help' then help()
        when 'ls' then ls(args)
        when 'q' then process.exit(0)
        else
            console.log('unknown command: %s', cmd)
            done

# CONFIG
cfgfile = __dirname + '/fbsh.conf.json'

auth = (cb) ->
    if (fs.existsSync(cfgfile))
        options = require(cfgfile)
        if (options.token)
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
        if (updateConfig)
            delete options.password
            options.token = client.token
            fs.writeFileSync(cfgfile, toJson(options), 'utf8')
        fb = client
        cb()

ls = (args) ->
    switch args[1]
        when 'f'
            fb.filters().then(printTable)
        when 'p'
            fb.projects().then(printProjects)
        when 'u'
            fb.people().then(printUsers)
        when 'm'
            fb.milestones().then(printMilestones)
        when 'search'
            fb.search(args[2]).then(printCases)
        when 'assign'
            printFail(fb.assign(args[2], args[3]))
        when 'done'
            printFail(fb.done(args[2], args[3]))
        else
            fb.search()
              # TODO do not hardcode active status
              .then((list) -> list.filter (x) -> x.status.id == 1)
              .then(printCases)

help = () ->
    console.log 'commands:'
    console.log '  ls                       - list active cases from current filter'
    console.log '  ls f                     - list available filters'
    console.log '  ls p                     - list available projects'
    console.log '  ls m                     - list available milestones'
    console.log '  ls u                     - list available users'
    console.log '  search q                 - searches cases by specified q'
    console.log '  assign <caseId> <userId> - assignes specified case to given user'
    done

# utils
isfn = (x) -> typeof x == 'function'
toJson = (x) -> JSON.stringify(x, null, 2)
printJson = (_) -> [].slice.call(arguments, 0).forEach((x) -> console.log(toJson(x)))
printFail = (p) ->
    p.fail (err) -> console.log err
    return p

unwrap = (x) ->
    if (x.id && x.name)
        return x.name;
    else
        return x

printTable = (list, keys) ->
    if (list.length == 0)
        return
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
    if (!user || !user.name)
        return ''
    arr = user.name.split(' ')
    if arr.length <= 1 then user.name else arr[0] + arr[1].substr(0, 1)
    

main()