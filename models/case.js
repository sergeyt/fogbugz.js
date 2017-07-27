const Utils = require('../utils');
const Base = require('./base');
const Event = require('./event');

function CaseSchema(customFields) {
  return {
    id: 'ixBug',
    status: {
      id: 'ixStatus',
      name: 'sStatus'
    },
    operations: '$.operations',
    opened: 'dtOpened',
    resolved: 'dtResolved',
    closed: 'dtClosed',
    due: 'dtDue',
    assignee: {
      id: 'ixPersonAssignedTo',
      name: 'sPersonAssignedTo',
      email: 'sEmailAssignedTo'
    },
    openedBy: {
      id: 'ixPersonOpenedBy'
    },
    resolvedBy: {
      id: 'ixPersonResolvedBy'
    },
    parentId: 'ixBugParent',
    originalId: 'ixBugOriginal',
    children: function(it) {
      return it.ixBugChildren[0].length ? it.ixBugChildren[0].split(',') : []
    },
    duplicates: 'ixBugDuplicates',
    title: 'sTitle',
    priority: {
      id: 'ixPriority',
      name: 'sPriority'
    },
    category: {
      id: 'ixCategory',
      name: 'sCategory'
    },
    project: {
      id: 'ixProject',
      name: 'sProject'
    },
    area: {
      id: 'ixArea',
      name: 'sArea'
    },
    milestone: {
      id: 'ixFixFor',
      name: 'sFixFor',
      end: 'dtFixFor'
    },
    version: 'sVersion',
    computer: 'sComputer',
    ticket: 'sTicket',
    latestSummary: 'sLatestTextSummary',
    isOpen: 'fOpen',
    storyPoints: 'dblStoryPts',
    releaseNotes: 'sReleaseNotes',
    isSubscribed: 'fSubscribed',
    tags: 'tags.tag[]',
    events: function(it) {
      return Utils.getarr(it, 'events', 'event').map(new Event(customFields));
    }
  }
}

function Case(customFields) {
  return Base.apply(this, [new CaseSchema(customFields), customFields]);
}

module.exports = Case;