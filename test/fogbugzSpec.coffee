fogbugz = require '../fogbugz'
expect = require 'expect.js'
_ = require 'underscore'

# creates fake request
fakeRequest = ->
	responses = []
	req = (url, cb) ->
		r = _.find responses, (x) ->
			return x[0](url) if typeof x[0] is 'function'
			return x[0].test(url)
		return cb('#{url} is not routed', null, null) if !r
		# TODO provide response object
		return cb null, {}, r[1] if typeof r[1] is 'string'
		throw new Error('not implemented!')

	req.get = req

	req.on = (matcher, response) ->
		matcher = new RegExp(matcher) if typeof matcher is 'string'
		responses.push [matcher, response]

	return req

create = (req) ->
	fogbugz
		url: 'http://fb.com',
		email: 'test@test.com',
		password: '1',
		request: req

create2 = (req) ->
	fogbugz
		url: 'http://fb.com',
		token: 'token',
		request: req

describe 'with fogbugz client', ->

	describe 'on login', ->
		it 'should parse api token', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<response><token>test</token></response>'
			create(req).then (fb) ->
				expect(fb.token).to.be('test')
				done()

	describe 'on bad response', ->
		it 'should fail with unexpected response', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<xml/>'
			create(req)
				.then ->
						expect().fail('should not be here')
						done()
				.fail (err) ->
						expect(err).to.be('unexpected response')
						done()

	describe 'on error in xml response', ->
		it 'should parse simple error string', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<response><error>error</error></response>'
			create(req)
				.then ->
					expect().fail('should not be here')
					done()
				.fail (err) ->
					expect(err).to.be('error')
					done()
		it 'should parse CDATA error string', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<response><error><![CDATA[error]]></error></response>'
			create(req)
				.then ->
						expect().fail('should not be here')
						done()
				.fail (err) ->
						expect(err).to.be('error')
						done()

	describe 'checking convertion of payloads', ->
		it 'project list', (done) ->
			req = fakeRequest()
			req.on /cmd=listProjects/, """
<response>
<projects>
  <project>
    <ixProject>11</ixProject>
    <sProject>The Project</sProject>
    <ixPersonOwner>123</ixPersonOwner>
    <sPersonOwner>Old MacDonald</sPersonOwner>
    <sEmail>grandpa@oldmacdonald.com</sEmail>
    <sPhone>555-294-4778</sPhone>
    <fInbox>false</fInbox>
    <iType>1</iType>
    <ixGroup>1</ixGroup>
    <sGroup>Internal</sGroup>
  </project>
</projects>
</response>"""
			create2(req).then((c) -> c.projects()).then (list)->
				expect(list.length).to.be(1)
				p = list[0]
				expect(p.id).to.be(11)
				expect(p.name).to.be('The Project')
				expect(p.owner.id).to.be(123)
				expect(p.owner.name).to.be('Old MacDonald')
				expect(p.email).to.be('grandpa@oldmacdonald.com')
				expect(p.phone).to.be('555-294-4778')
				expect(p.inbox).to.be(false)
				expect(p.type).to.be(1)
				expect(p.group).to.be('Internal')
				done()
