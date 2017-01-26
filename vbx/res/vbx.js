var nav = null;
var buttons = [];
var main = null;
var conversations = [];
var contacts = null;
var phone = null;
var message = null;
var message_number = null;
var last = null;
var state = 'idle';
var statusline = null;

var contact = {};

var number = null;

var token = null;
var connection = null;
var incoming = null;

var messageTime = new Date().toISOString();

var xhr = function(method, resource, data, callback) {
	var req = new XMLHttpRequest();

	req.responseType = 'json';

	req.addEventListener('load', function(ev) {
		callback === undefined || callback(req.response);
	});

	req.open(method, resource);
	if (data === undefined) {
		req.send();
	}
	else {
		req.setRequestHeader('Content-Type', 'application/json');
		req.send(JSON.stringify(data));
	}
};

var load = function() {
	// get elements
	nav = document.getElementById('nav');
	buttons = [document.getElementById('button_contacts'), document.getElementById('button_message'), document.getElementById('button_phone')];
	main = document.getElementById('main');
	conversations = [];
	contacts = document.getElementById('contacts');
	phone = document.getElementById('phone');
	message = document.getElementById('message');
	message_number = document.getElementById('message_number');
	statusline = document.getElementById('status');

	contact = {};

	// load contacts
	xhr('get', '/contacts/', undefined, function(response) {
		contact = response;

		Object.keys(contact).forEach(function(key) {
			var li = document.createElement('li');

			var span_name = document.createElement('span');
			var span_number = document.createElement('span');
			var button_call = document.createElement('button');
			var button_message = document.createElement('button');

			span_name.innerText = contact[key];
			span_number.innerText = key;

			button_call.innerText = 'Call';
			button_message.innerText = 'Message';

			button_call.addEventListener('click', function(ev) {
				window.call(key);
			});
			button_message.addEventListener('click', function(ev) {
				window.open(key);
			});

			li.appendChild(span_name);
			li.appendChild(span_number);
			li.appendChild(button_call);
			li.appendChild(button_message);

			contacts.appendChild(li);
		});
	});

	// setup callbacks
	xhr('get', '/browser', undefined, function(data) {
		// get number
		number = data.number;

		// get token
		token = data.token;

		// setup Twilio.Device
		Twilio.Device.setup(token);

		Twilio.Device.connect(function (conn) {
			state = 'connected';
			statusline.innerText = 'Connected.';
		});

		Twilio.Device.disconnect(function (conn) {
			state = 'idle';
			statusline.innerText = 'Dial a Number';
		});

		Twilio.Device.incoming(function (conn) {
			state = 'incoming';

			incoming = conn;

			// get from name
			from = conn.parameters.From;

			if (from in contact)
				from = contact[from];

			statusline.innerText = 'Incoming Call From ' + from;

			// open phone
			select('phone');
		});

		Twilio.Device.offline(function(device) {
			// get another token
			xhr('get', '/browser', undefined, function(data) {
				// get token
				token = data.token;

				// setup Twilio.Device
				Twilio.Device.setup(token);
			});
		});

		// setup message callbacks
		var messageUpdate = function() {
			var current = messageTime;
			var next = new Date().toISOString();

			xhr('get', '/msgs/?date_sent_after=' + current + '&to=' + number, undefined, function(data) {
				data.forEach(function(message) {
					window.open(message.from, message);
				});
			});

			xhr('get', '/msgs/?date_sent_after=' + current + '&from=' + number, undefined, function(data) {
				data.forEach(function(message) {
					window.open(message.to, message);
				});
			});

			messageTime = next;

			setTimeout(messageUpdate, 2000);
		};

		// initiate message updates
		messageUpdate();

		// setup ping callbacks
		var pingUpdate = function() {
			xhr('post', '/browser', {});

			setTimeout(pingUpdate, 5000);
		};

		// initiate ping updates
		pingUpdate();
	});

	// select nothing
	select(null);

	// show body
	document.body.style.display = 'flex';
};

var open = function(number, message) {
	var show = function(number) {
		// create new chat block
		var chat = document.createElement('div');
		chat.id = number;
		chat.classList.add('chat');
		chat.style.display = 'none';

		var container = document.createElement('div');

		var input = document.createElement('input');
		input.type = 'text';
		input.placeholder = 'Enter Message Here...';
		input.addEventListener('keyup', function(ev) {
			if (ev.keyCode === 13) {
				ev.preventDefault();
				xhr('post', '/msg', {'to': number, 'body': input.value});
				input.value = '';
			}
		});

		chat.appendChild(container);
		chat.appendChild(input);

		main.appendChild(chat);
		conversations.push(chat);

		// create button
		var button_container = document.createElement('div');
		button_container.id = 'nav_' + number;

		var button = document.createElement('button');
		button.id = 'button_' + number;
		if (number in contact)
			button.innerText = contact[number];
		else
			button.innerText = number;
		button.addEventListener('click', function(ev) { window.select(number) });

		buttons.push(button);

		var close = document.createElement('button');
		close.classList.add('close');
		close.innerText = '×';
		close.addEventListener('click', function(ev) { window.close(number) });

		button_container.appendChild(button);
		button_container.appendChild(close);

		nav.insertBefore(button_container, nav.firstChild);

		return container;
	}

	var write = function(container, message) {
		// create chat bubble
		var div = document.createElement('div');

		// set class based on whether this was sent or receieved
		if (message.from === number)
			div.classList.add('me');
		else
			div.classList.add('you');

		// get message time
		var date = new Date(message.date);

		// format time
		var time = document.createElement('time');
		time.innerText = '';
		time.innerText += date.getFullYear();
		time.innerText += '-';
		time.innerText += ('0' + (date.getMonth() + 1)).slice(-2);
		time.innerText += '-';
		time.innerText += ('0' + date.getDate()).slice(-2);
		time.innerText += ' ';
		time.innerText += ('0' + date.getHours()).slice(-2);
		time.innerText += ':';
		time.innerText += ('0' + date.getMinutes()).slice(-2);

		// add body
		var p = document.createElement('p');
		p.innerText = message.body;

		// join time and body into message
		div.appendChild(time);
		div.appendChild(p);

		// add message to chat window
		container.appendChild(div);
	}

	if (document.getElementById(number) === null) {
		// show number
		var container = show(number);

		// load chat
		xhr('get', '/msgs/?to=' + number, undefined, function(data) {
			xhr('get', '/msgs/?from=' + number, undefined, function(dataInner) {
				// get all messages
				var messages = data.concat(dataInner);

				// sort by date
				messages.sort(function(left, right) {
					return new Date(left.date) - new Date(right.date);
				});

				// generate elements
				messages.forEach(function(message) {
					write(container, message);
				});

				// scroll chat down
				container.scrollTop = 2147483646;
			});
		});
	}
	else {
		// get container
		var container = document.getElementById(number).children[0];

		// load given message
		if (message !== undefined)
			write(container, message);

		// scroll chat down
		container.scrollTop = 2147483646;
	}

	// bring chat forward
	select(number);
};

var close = function(number) {
	var chat = document.getElementById(number);

	if (chat === null)
		return;

	// remove chat block
	main.removeChild(chat);
	conversations.splice(conversations.indexOf(chat), 1);

	var container = document.getElementById('nav_' + number);

	if (container === null)
		return;

	// remove button
	nav.removeChild(container);
	buttons.splice(buttons.indexOf(container.children[0]), 1);

	// bring last thing forward
	select(last);
};

var click = function(key) {
	if (key === 'message') {
		window.open(message_number.value);
		message_number.value = '';

		return;
	}

	if (state === 'connecting' || state === 'connected') {
		if (key === 'hangup') {
			hangup();
		}
		else if (key === 'dial') {
			// do nothing
		}
		else {
			connection.sendDigits(key);
		}
	}
	else if (state === 'idle') {
		if (key === 'hangup') {
			// do nothing
		}
		else if (key === 'dial') {
			// do nothing
		}
		else {
			statusline.innerText = key;
		}

		state = 'dialing';
	}
	else if (state === 'dialing') {
		if (key === 'dial') {
			call(statusline.innerText);
		}
		else if (key === 'hangup') {
			statusline.innerText = 'Dial a Number...';

			state = 'idle';
		}
		else {
			statusline.innerText += key;
		}
	}
	else if (state === 'incoming') {
		if (key === 'dial') {
			incoming.accept();

			connection = incoming;
		}
		else if (key === 'hangup') {
			incoming.reject();
		}

		state = 'connected';
		status.innerText = 'Connected.';
	}
};

var call = function(number) {
	// update state
	state = 'connecting';

	// create connection
	connection = Twilio.Device.connect({'To': number});

	// call number
	select('phone');
};

var hangup = function() {
	// close phone
	select(last);

	// disconnect line
	Twilio.Device.disconnectAll();
};

var select = function(id) {
	if (id === 'toggle_phone') {
		if (phone.style.display === 'none')
			// behave as though phone were selected
			id = 'phone';
		else
			// behave as though last were selected
			id = last;
	}
	else if (id === 'toggle_message') {
		if (message.style.display === 'none')
			// behave as though message were selected
			id = 'message';
		else
			// behave as though last were selected
			id = last;
	}

	if (id === 'phone') {
		// simply display phone
		phone.style.display = '';
		message.style.display = 'none';
	}
	else if (id === 'message') {
		// display message
		message.style.display = '';
		phone.style.display = 'none';
	}
	else {
		// close all conversations
		conversations.forEach(function(element) {
			element.style.display = 'none';
		});

		// close phone and contacts
		contacts.style.display = 'none';
		message.style.display = 'none';
		phone.style.display = 'none';

		// display requested section
		if (id !== null) {
			var target = document.getElementById(id);
			if (target !== null)
				target.style.display = '';
			else
				id = null;
		}
	}

	// disable all buttons
	buttons.forEach(function(element) {
		element.classList.remove('active');
	});

	// mark respective button as active
	if (id !== null)
		document.getElementById('button_' + id).classList.add('active');

	if (id !== 'phone' && id !== 'message')
		last = id;
};

window.addEventListener('load', load);
