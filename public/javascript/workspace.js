
// javascript/workspace.js

// DOM Ready ===================================================================

$(document).ready(function() {
	// power the 'Home' button
	$('a#closeWindowBtn').on('click', function () { window.close(); });

	// power the 'Refresh' button
	$('a#refreshBtn').on('click', renderTable);

	// power the 'New' button
	$('a#newBtn').on('click', newWorkspace);

	// power the 'Save' buttons
	$('a#saveBtn').on('click', saveRow);

	// power the 'Delete' buttons
	$('a#deleteBtn').on('click', deleteRow);

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
	$.each(workspace.users, function (userId) {
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

	$.getJSON('/workspaces', function (workspaces) {
		$.each(workspaces, function(workspace) {
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

			rowsSpan.append(rowString);

			populateRow(workspace);
		});
	});
}

function saveRow(event) {
	if (event)
		event.preventDefault();

	console.log('save row.');
}

function deleteRow(event) {
	if (event)
		event.preventDefault();

	console.log('delete row.');
}

function newWorkspace(event) {
	if (event)
		event.preventDefault();

	console.log('new workspace.');
}
