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

	it 'check required options', ->
		expect(-> fogbugz()).to.throwError('Options are not specified.')
		expect(-> fogbugz({url:''})).to.throwError('Required url option is not specified.')
		expect(-> fogbugz({url:123})).to.throwError('Required url option is not specified.')
		expect(-> fogbugz({url:'fb.com', token: ''})).to.throwError('token option is empty.')
		expect(-> fogbugz({url:'fb.com', email: ''})).to.throwError('Required email option is not specified.')
		expect(-> fogbugz({url:'fb.com', user: ''})).to.throwError('Required email option is not specified.')
		expect(-> fogbugz({url:'fb.com', email: 'abc', password: ''})).to.throwError('Required password option is not specified.')
		expect(-> fogbugz({url:'fb.com', email: 'abc', pwd: ''})).to.throwError('Required password option is not specified.')

	describe 'on login', ->
		it 'should parse api token', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<response><token>test</token></response>'
			req.on /cmd=logoff/, '<response>ok</response>'
			create(req).then (fb) ->
				expect(fb.token).to.be('test')
				fb.logout().done -> done()

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

		it 'should fail with xml parse error', (done) ->
			req = fakeRequest()
			req.on /cmd=logon/, '<>'
			create(req)
				.then ->
					expect().fail('should not be here')
					done()
				.fail (err) ->
					expect(err.message || err).to.match(/(Invalid XML)|(Line:)/)
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

	describe 'check convertion of', ->
		it 'project list payload', (done) ->
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

		it 'milestone list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listFixFors/, """
<response>
<fixfors>
  <fixfor>
    <ixFixFor>1</ixFixFor>
    <sFixFor>Undecided</sFixFor>
    <fDeleted>0</fDeleted>
    <dt/>
    <dtStart/>
    <sStartNote/>
    <setixFixForDependency/>
    <ixProject/>
    <sProject/>
  </fixfor>
  <fixfor>
    <ixFixFor>2</ixFixFor>
    <sFixFor>2005.1</sFixFor>
    <fDeleted>0</fDeleted>
    <dt>2005-12-05T00:00:00Z</dt>
    <dtStart>2005-10-01T00:00:00Z</dtStart>
    <sStartNote>Can't start work until the hardware arrives.</sStartNote>
    <setixFixForDependency><ixFixFor>3</ixFixFor></setixFixForDependency>
    <ixProject>5</ixProject>
    <sProject>New York City</sProject>
  </fixfor>
</fixfors>
</response>"""
			fb = null
			create2(req).then((c) ->
			  fb = c
			  c.milestones()).then (list)->
				expect(list.length).to.be(2)
				x = list[0]
				expect(x.id).to.be(1)
				expect(x.name).to.be('Undecided')
				x = list[1]
				expect(x.id).to.be(2)
				expect(x.name).to.be('2005.1')
				fb.milestone(x)
				done()

		it 'milestone cases payload', (done) ->
			req = fakeRequest()
			req.on /cmd=search/, """
<response>
<cases>
	<case>
		<ixBug>123</ixBug>
	</case>
</cases>
</response>"""
			create2(req).then((c) -> c.milestone({name:'test'}).cases()).then (list)->
				expect(list.length).to.be(1)
				x = list[0]
				expect(x.id).to.be(123)
				done()

		it 'case list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=search.+cols=events/, '<response><events></events></response>'
			req.on /cmd=search/, """
<response>
<cases count='1'>
  <case ixBug='123' operations='edit,assign,resolve,reactivate,close,reopen,reply,forward,email,move,spam,remind'>
  	<ixBug>123</ixBug>
    <ixBugParent>234</ixBugParent>
    <ixBugChildren>456,876</ixBugChildren>
    <tags>
      <tag><![CDATA[first]]></tag>
      <tag><![CDATA[second]]></tag>
      <tag><![CDATA[third]]></tag>
    </tags>
    <fOpen>true</fOpen>
    <sTitle>title</sTitle>
    <sOriginalTitle>original title</sOriginalTitle>
    <sLatestTextSummary>I searched the docs, but no goose!</sLatestTextSummary>
    <ixBugEventLatestText>1151</ixBugEventLatestText>
    <ixProject>22</ixProject>
    <sProject>The Farm</sProject>
    <ixArea>35</ixArea>
    <sArea>Pond</sArea>
    <ixGroup>6</ixGroup>
    <ixPersonAssignedTo>1</ixPersonAssignedTo>
    <sPersonAssignedTo>Old MacDonald</sPersonAssignedTo>
    <sEmailAssignedTo>grandpa@oldmacdonald.com</sEmailAssignedTo>
    <ixPersonOpenedBy>2</ixPersonOpenedBy>
    <ixPersonResolvedBy>2</ixPersonResolvedBy>
    <ixPersonClosedBy></ixPersonClosedBy>
    <ixPersonLastEditedBy>0</ixPersonLastEditedBy>
    <ixStatus>2</ixStatus>
    <ixBugDuplicates>321</ixBugDuplicates>
    <ixBugOriginal>654</ixBugOriginal>
    <sStatus>Geschlossen (Fixed)</sStatus>
    <ixPriority>3</ixPriority>
    <sPriority>Must Fix</sPriority>
    <ixFixFor>3</ixFixFor>
    <sFixFor>Test</sFixFor>
    <dtFixFor>2007-05-06T22:47:59Z</dtFixFor>
    <sVersion></sVersion>
    <sComputer></sComputer>
    <hrsOrigEst>0</hrsOrigEst>
    <hrsCurrEst>0</hrsCurrEst>
    <hrsElapsed>0</hrsElapsed>
    <c>0</c>
    <sCustomerEmail></sCustomerEmail>
    <ixMailbox>0</ixMailbox>
    <ixCategory>1</ixCategory>
    <sCategory>Feature</sCategory>
    <dtOpened>2007-05-06T22:47:59Z</dtOpened>
    <dtResolved>2007-05-06T22:47:59Z</dtResolved>
    <dtClosed>2007-05-06T22:47:59Z</dtClosed>
    <ixBugEventLatest>1151</ixBugEventLatest>
    <dtLastUpdated>2007-05-06T22:47:59Z</dtLastUpdated>
    <fReplied>false</fReplied>
    <fForwarded>false</fForwarded>
    <sTicket></sTicket>
    <ixDiscussTopic>0</ixDiscussTopic>
    <dtDue></dtDue>
    <sReleaseNotes></sReleaseNotes>
    <ixBugEventLastView>1151</ixBugEventLastView>
    <dtLastView>2007-05-06T22:47:59Z</dtLastView>
    <ixRelatedBugs>345,267,2920</ixRelatedBugs>
    <sScoutDescription>Main.cpp:165</sScoutDescription>
    <sScoutMessage>Please contact us or visit our knowledge base to resolve.</sScoutMessage>
    <fScoutStopReporting>false</fScoutStopReporting>
    <dtLastOccurrence>2007-05-06T22:47:59Z</dtLastOccurrence>
    <fSubscribed>true</fSubscribed>
  </case>
</cases>
</response>"""
			create2(req).then((c) -> c.search()).then (list)->
				expect(list.length).to.be(1)
				x = list[0]
				expect(x.id).to.be(123)
				expect(x.title).to.be('title')
				expect(x.assignee.name).to.be('Old MacDonald')
				expect(x.assignee.email).to.be('grandpa@oldmacdonald.com')
				# todo check more fields
				done()

		it 'empty case list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=search/, "<response><cases></cases></response>"
			create2(req).then((c) -> c.search('', 100, true)).then (list)->
				expect(list.length).to.be(0)
				done()

		it 'filter list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listFilters/, """
<response>
<filters>
  <filter type="builtin" sFilter="ez349">filter1</filter>
  <filter type="saved" sFilter="304">filter2</filter>
  <filter type="shared" sFilter="98" status="current">filter3</filter>
</filters>
</response>"""
			create2(req).then((c) -> c.filters()).then (list)->
				expect(list.length).to.be(3)
				x = list[0]
				expect(x.type).to.be('builtin')
				expect(x.id).to.be('ez349')
				expect(x.name).to.be('filter1')
				x = list[1]
				expect(x.type).to.be('saved')
				expect(x.id).to.be('304')
				expect(x.name).to.be('filter2')
				x = list[2]
				expect(x.type).to.be('shared')
				expect(x.id).to.be('98')
				expect(x.name).to.be('filter3')
				expect(x.status).to.be('current')
				done()

		it 'area list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listAreas/, """
<response>
<areas>
  <area>
    <ixArea>53</ixArea>
    <sArea>core</sArea>
    <ixProject>23</ixProject>
    <sProject>project</sProject>
    <ixPersonOwner>32</ixPersonOwner>
    <sPersonOwner>owner</sPersonOwner>
    <nType>0</nType>
    <cDoc>0</cDoc>
  </area>
</areas>
</response>"""
			create2(req).then((c) -> c.areas()).then (list)->
				expect(list.length).to.be(1)
				x = list[0]
				expect(x.id).to.be(53)
				expect(x.name).to.be('core')
				expect(x.project.id).to.be(23)
				expect(x.project.name).to.be('project')
				expect(x.owner.id).to.be(32)
				expect(x.owner.name).to.be('owner')
				expect(x.type).to.be(0)
				expect(x.doc).to.be('0')
				done()

		it 'category list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listCategories/, """
<response>
<categories>
  <category>
    <ixCategory>1</ixCategory>
    <sCategory>Bug</sCategory>
    <sPlural>Bugs</sPlural>
    <ixStatusDefault>2</ixStatusDefault>
    <fIsScheduleItem>false</fIsScheduleItem>
  </category>
  <category>
    <ixCategory>2</ixCategory>
    <sCategory>Feature</sCategory>
    <sPlural>Features</sPlural>
    <ixStatusDefault>8</ixStatusDefault>
    <fIsScheduleItem>false</fIsScheduleItem>
  </category>
</categories>
</response>"""
			create2(req).then((c) -> c.categories()).then (list)->
				expect(list.length).to.be(2)
				x = list[0]
				expect(x.id).to.be(1)
				expect(x.name).to.be('Bug')
				expect(x.plural).to.be('Bugs')
				expect(x.isScheduleItem).to.be(false)
				expect(x.on.resolve).to.be(2)
				x = list[1]
				expect(x.id).to.be(2)
				expect(x.name).to.be('Feature')
				expect(x.plural).to.be('Features')
				expect(x.isScheduleItem).to.be(false)
				expect(x.on.resolve).to.be(8)
				done()

		it 'priority list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listPriorities/, """
<response>
<priorities>
  <priority>
    <ixPriority>1</ixPriority>
    <sPriority>Very Urgent</sPriority>
  </priority>
</priorities>
</response>"""
			create2(req).then((c) -> c.priorities()).then (list)->
				expect(list.length).to.be(1)
				x = list[0]
				expect(x.id).to.be(1)
				expect(x.name).to.be('Very Urgent')
				done()

		it 'status list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listStatuses/, """
<response>
<statuses>
  <status>
    <ixStatus>1</ixStatus>
    <sStatus><![CDATA[Active]]></sStatus>
    <ixCategory>1</ixCategory>
    <fWorkDone>false</fWorkDone>
    <fResolved>false</fResolved>
    <fDuplicate>false</fDuplicate>
    <fDeleted>false</fDeleted>
    <iOrder>0</iOrder>
  </status>
  <status>
    <ixStatus>2</ixStatus>
    <sStatus><![CDATA[Resolved (Fixed)]]></sStatus>
    <ixCategory>1</ixCategory>
    <fWorkDone>true</fWorkDone>
    <fResolved>true</fResolved>
    <fDuplicate>false</fDuplicate>
    <fDeleted>false</fDeleted>
    <iOrder>0</iOrder>
  </status>
</statuses>
</response>"""
			create2(req).then((c) -> c.statuses()).then (list)->
				expect(list.length).to.be(2)
				x = list[0]
				expect(x.id).to.be(1)
				expect(x.name).to.be('Active')
				expect(x.workDone).to.be(false)
				expect(x.isResolved).to.be(false)
				expect(x.isDuplicate).to.be(false)
				expect(x.isDeleted).to.be(false)
				expect(x.order).to.be(0)
				x = list[1]
				expect(x.id).to.be(2)
				expect(x.name).to.be('Resolved (Fixed)')
				expect(x.workDone).to.be(true)
				expect(x.isResolved).to.be(true)
				expect(x.isDuplicate).to.be(false)
				expect(x.isDeleted).to.be(false)
				expect(x.order).to.be(0)
				done()

		it 'user list payload', (done) ->
			req = fakeRequest()
			req.on /cmd=listPeople/, """
<response>
<people>
  <person>
    <ixPerson>11</ixPerson>
    <sFullName>admin</sFullName>
    <sEmail>admin@admins.net</sEmail>
    <sPhone>123456789</sPhone>
    <fAdministrator>true</fAdministrator>
    <fCommunity>false</fCommunity>
    <fVirtual>false</fVirtual>
    <fDeleted>false</fDeleted>
    <fNotify>true</fNotify>
    <sHomepage>homepage</sHomepage>
    <sLocale>en-us</sLocale>
    <sLanguage>en-us</sLanguage>
    <sTimeZoneKey>Eastern Standard Time</sTimeZoneKey>
    <fExpert>true</fExpert>
  </person>
</people>
</response>"""
			create2(req).then((c) -> c.users()).then (list)->
				expect(list.length).to.be(1)
				x = list[0]
				expect(x.id).to.be(11)
				expect(x.name).to.be('admin')
				expect(x.email).to.be('admin@admins.net')
				expect(x.phone).to.be('123456789')
				expect(x.admin).to.be(true)
				expect(x.community).to.be(false)
				expect(x.virtual).to.be(false)
				expect(x.deleted).to.be(false)
				expect(x.notify).to.be(true)
				expect(x.expert).to.be(true)
				expect(x.homepage).to.be('homepage')
				expect(x.locale).to.be('en-us')
				expect(x.language).to.be('en-us')
				expect(x.timeZoneKey).to.be('Eastern Standard Time')
				done()
