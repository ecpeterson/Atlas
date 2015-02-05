
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

	// render the table for the first time
	renderTable();
});

// Utility functions ===========================================================

function populateRow(workspace) {
	var tableRow = $('#tableEntries tr#RowID' + workspace._id);

	var titleText = tableRow.find('#title');
	titleText.val(workspace.title);

	var usersTextarea = tableRow.find('#users');
	var usersString = '';
	$.each(workspace.users, function (index) {
		var userId = workspace.users[index];
		if (usersString)
			usersString += '\n';
		usersString += userId;
	});
	usersTextarea.val(usersString);
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
			rowString += '<td><textarea id="users" style="width:100%" rows=3>' +
						 '</textarea></td>';
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
	var usersTextarea = tableRow.find('#users');

	// construct a new workspace object to JSONify
	var freshWorkspace = {};
	freshWorkspace.title = titleText.val();
	freshWorkspace.users = usersTextarea.val().split(/\n/);
	freshWorkspace.text = '';

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
