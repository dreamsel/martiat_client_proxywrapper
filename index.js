const {client: WebSocketClient, connection: WebSocketConnection} = require('websocket');
const {spawn} = require('child_process');

require('dotenv').load();

const serverIp = process.argv[2] || process.env.SERVER_IP || 'localhost:3000';
const childPath = process.argv[3] || process.env.CHILD_PATH || './child';
const myId = process.argv[4] || process.env.CLIENT_ID || 1;

const child = spawn(childPath);
console.log('started shild ', childPath);

let wsConnection = null;

child.stdout.on('data', (data) => {
  const strData = data.toString('utf8').trim();
  try {
    const json = JSON.parse(strData);
    console.log('message from child to server', json);
    wsConnection.send(JSON.stringify({id: myId, answer: json}));
  } catch (e) {
    console.log('non-json msg from child:', strData);
  }
});
child.on('error', (err) => {
  console.log('child error', err.message, err.errno, err.path);
});
child.on('exit', (code, signal) => {
  console.log('child exit', code, signal);
  wsConnection && wsConnection.close(WebSocketConnection.CLOSE_REASON_GOING_AWAY, 'Child gone');
  process.exit(code);
});
child.on('close', (code, signal) => {
  console.log('child close', code, signal);
  wsConnection && wsConnection.close(WebSocketConnection.CLOSE_REASON_GOING_AWAY, 'Child finished');
  process.exit(code);
});


const client = new WebSocketClient();
client.on('connect', (connection) => {
  console.log('connected to server ', connection.remoteAddress);
  wsConnection = connection;
  connection.on('message', (message) => {
    try {
      if (message.type === 'utf8') {
        try {
          const json = JSON.parse(message.utf8Data);
          if (json.error) {
            console.log('error on server', json.error);
          }
        } catch (e) {
          // do nothing
        }
        console.log('message from server to child', message);
        child.stdin.write(message.utf8Data + '\n');
      }
    } catch (e) {
      console.log('error when sent to child', e.message);
    }
  });
  connection.on('close', (code, descr) => {
    console.log('connection closed', code, descr, ' RECONNECTING');
    setTimeout(() => client.connect(`ws://${serverIp}`), 2000);
  });
  connection.on('error', (err) => {
    console.log('connection error', err, ' RECONNECTING');
    setTimeout(() => client.connect(`ws://${serverIp}`), 2000);
  })
  console.log('handshaking with id ', myId);
  connection.send(JSON.stringify({id: myId, answer: []}));
});
client.on('connectFailed', (err) => {
  console.log('client: connect failed', err.message);
  console.log('reconnecting');
  setTimeout(() => client.connect(`ws://${serverIp}`), 2000);
});
client.connect(`ws://${serverIp}`);
