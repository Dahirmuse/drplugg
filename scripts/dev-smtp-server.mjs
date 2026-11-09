/**
 * Minimal SMTP-server för att TESTA mejlutskick lokalt utan riktiga uppgifter.
 *
 *   npm run mail:test        (lyssnar på 127.0.0.1:1025)
 *
 * Allt som skickas sparas i /tmp/drplugg-devmail.log. Pejla om appen hit med
 * config/smtp.json:
 *   { "SMTP": { "Host": "127.0.0.1", "Port": 1025, "EnableSSL": false,
 *               "UserName": "dev", "Password": "dev",
 *               "FromAddress": "noreply@drplugg.local", "FromName": "DrPlugg" } }
 */
import net from "node:net";
import fs from "node:fs";

const PORT = Number(process.env.DEV_SMTP_PORT || 1025);
const LOG = "/tmp/drplugg-devmail.log";

const server = net.createServer((socket) => {
  let inData = false;
  let buffer = "";
  let message = "";
  let rcpt = [];

  socket.write("220 localhost DrPlugg dev-SMTP\r\n");

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    for (;;) {
      if (inData) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        message += buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        inData = false;

        fs.appendFileSync(
          LOG,
          `\n===== MEJL ${new Date().toISOString()} → ${rcpt.join(", ")} =====\n${message}\n`,
        );
        rcpt = [];
        message = "";
        socket.write("250 OK: queued\r\n");
        continue;
      }

      const idx = buffer.indexOf("\r\n");
      if (idx === -1) return;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const cmd = line.toUpperCase();

      if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
        socket.write("250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SIZE 10485760\r\n");
      } else if (cmd.startsWith("AUTH")) {
        socket.write("235 2.7.0 Authentication successful\r\n");
      } else if (cmd.startsWith("MAIL FROM")) {
        socket.write("250 OK\r\n");
      } else if (cmd.startsWith("RCPT TO")) {
        rcpt.push(line.replace(/^RCPT TO:\s*/i, ""));
        socket.write("250 OK\r\n");
      } else if (cmd === "DATA") {
        inData = true;
        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      } else if (cmd === "RSET") {
        rcpt = [];
        socket.write("250 OK\r\n");
      } else if (cmd === "NOOP") {
        socket.write("250 OK\r\n");
      } else if (cmd.startsWith("QUIT")) {
        socket.write("221 Bye\r\n");
        socket.end();
        return;
      } else {
        socket.write("250 OK\r\n");
      }
    }
  });

  socket.on("error", () => {});
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Dev-SMTP lyssnar på 127.0.0.1:${PORT} – mejl sparas i ${LOG}`);
});
