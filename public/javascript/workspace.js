
// javascript/workspace.js

// DOM Ready ===================================================================

$(document).ready(function() {
	// power the 'Home' button
	$('a#closeWindowBtn').on('click', function () { window.close(); });

	// power the 'Refresh' button
	$('tbody').on('click', 'tr td a#refreshBtn', renderTable);

	// power the 'New' button
	$('tbody').on('click', 'tr td a#newBtn', newWorkspace);

	// power the 'Save' buttons
	$('tbody').on('click', 'tr td a#saveBtn', saveRow);

	// power the 'Delete' buttons
	$('tbody').on('click', 'tr td a#deleteBtn', deleteRow);

	// power the 'add new user' buttons
	$('tbody').on('click', 'tr td ul#users a#addUserBtn', addUserBtnFn);

	// power the 'delete existing user' buttons
	$('tbody').on('click', 'tr td ul#users span a#delUserBtn', delUserBtnFn);

	// render the table for the first time
	renderTable();
});

// Utility functions ===========================================================

function populateRow(workspace) {
	var tableRow = $('#tableEntries tr#RowID' + workspace._id);

	var titleText = tableRow.find('#title');
	titleText.val(workspace.title);

	var usersList = tableRow.find('#users span');
	var usersString = '';
	$.each(workspace.users, function (index) {
		var userId = workspace.users[index];
		$.getJSON('/user/' + userId, function (user) {
			usersList.append(
				'<li rel="ALREADYADDED"><a href="#" ' +
				'class="btn btn-default btn-sm" rel="' + userId + '" ' +
				'id="delUserBtn">–</a> ' + user.name + ' (' + user.email +
				')</li>');
		});
	});
}

// User-triggerable functions ==================================================

function renderTable(event) {
	if (event)
		event.preventDefault();

	var rowsSpan = $('#tableEntries');

	var defaultRow = '<tr>';
	defaultRow += '<td></td>';
	defaultRow += '<td></td>';
	defaultRow += '<td><a href="#" class="btn btn-default btn-sm" ' +
				  'id="refreshBtn">Refresh</a></td>';
	defaultRow += '<td><a href="#" class="btn btn-default btn-sm" id="newBtn"' +
				  '>New</a></td>';
	defaultRow += '</tr>';

	rowsSpan.html(defaultRow);

	$.getJSON('/workspaces', function (workspaces) {
		$.each(workspaces, function(index) {
			var workspace = workspaces[index];
			var rowString = '<tr id="RowID' + workspace._id + '">';
			rowString += '<td><input id="title" type="text" ' +
						 'placeholder="Title" /></td>';
			rowString += '<td><ul id="users"><span></span>' +
						 '<li><a href="#" class="btn btn-default btn-sm" ' +
						 'id="addUserBtn" rel="' + workspace._id + '">+</a>' +
						 '</li></ul></td>';
			rowString += '<td><a href="#" class="btn btn-default btn-sm" ' +
						 'id="saveBtn" rel="' + workspace._id +
						 '">Save</a>';
			rowString += '<td><a href="#" class="btn btn-default btn-sm" ' +
						 'id="deleteBtn" rel="' + workspace._id +
						 '">Delete</a>';
			rowString += '</tr>';

			rowsSpan.prepend(rowString);

			populateRow(workspace);
		});
	});
}

function saveRow(event) {
	if (event)
		event.preventDefault();

	// find the workspace ID & DOM elements
	var workspaceId = $(this).attr('rel');
	var tableRow = $('#tableEntries tr#RowID' + workspaceId);
	var titleText = tableRow.find('#title');
	var usersList = $(this).parents('tr').find('span li');

	// construct a new workspace object to JSONify
	var freshWorkspace = {};
	freshWorkspace.title = titleText.val();
	freshWorkspace.text = '';

	// assemble users we already have IDs for
	freshWorkspace.users = usersList.filter(function (i, e) {
			return $(e).attr('rel') == 'ALREADYADDED';
		}).map(function (i, e) {
			return $(e).find('#delUserBtn').attr('rel');
		}).toArray();

	// also assemble users we don't yet have IDs for
	freshWorkspace.newUsers = usersList.filter(function (i, e) {
			return $(e).attr('rel') == 'NOTYETADDED';
		}).map(function (i, e) {
			return $(e).find('#userEmail').val();
		}).toArray();

	$.ajax({
		type : 'PUT',
		url : '/workspace/' + workspaceId,
		data : freshWorkspace,
		dataType : 'JSON'
	}).done(function(response) {
		if (response.msg) {
			alert('Error: ' + response.msg);
			// don't throw out the user's changes if we failed to commit.
			return;
		}

		renderTable();
	});
}

function deleteRow(event) {
	if (event)
		event.preventDefault();

	var workspaceId = $(this).attr('rel');

	var confirmation = confirm('Are you sure you want to delete this workspace?');

	if (confirmation === false) {
		return false;
	}

	// OK, they said they really want to delete the work space. let's do it.
	$.ajax({
		type : 'DELETE',
		url : '/workspace/' + workspaceId
	}).done(function(response) {
		if (response.msg)
			alert('Error: ' + response.msg);

		renderTable();
	});
}

function newWorkspace(event) {
	if (event)
		event.preventDefault();

	$.post('/newworkspace', function (response) {
		if (response.msg) {
			alert('Error: ' + response.msg);
		}

		renderTable();
	});
}

function addUserBtnFn(event) {
	if (event)
		event.preventDefault();

	var workspaceId = $(this).attr('rel');
	var tableRow = $('#tableEntries tr#RowID' + workspaceId);

	var usersList = tableRow.find('#users span');
	var usersString =  '<li rel="NOTYETADDED"><a href="#" ' +
					   'class="btn btn-default btn-sm" id="delUserBtn">–</a>' +
					   '<input id="userEmail" type="text" ' + 
					   'placeholder="User email address" /></li>';
	usersList.append(usersString);

	return;
}

function delUserBtnFn(event) {
	if (event)
		event.preventDefault();

	$(this).parents('li').remove();
	
	return;
}
