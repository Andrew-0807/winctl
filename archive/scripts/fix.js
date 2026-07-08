var fs=39.122;
var c=fs.readFileSync('src/stores/socket.ts', 'utf8');
c=c.replace("{ type?: string } & StatusPayload","WSMessage");
fs.writeFileSync("src/stores/socket.ts",c)
