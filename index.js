const dotenv = require("dotenv");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { init } = require("./db");
const cors = require("cors");
const routes = require("./routes");
const app = express();
const http = require("http").Server(app);
const CryptoJS = require("crypto-js");
const hash_list = require("./hash_list.json");
const web3 = require("@solana/web3.js");
const bs58 = require("bs58");
const cron = require("node-cron");

var corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(routes);

// init();

const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("new connection");
  socket.on("history", (msg) => {
    io.emit("historyChanged", msg);
    console.log("history changed emitted");
  });
});

app.get("/api/historyChange", (req, res, next) => {
  console.log("his changed");
  io.emit("historyChanged", "history has changed");
});

const decrypt = (sig) => {
  let bytes = CryptoJS.AES.decrypt(sig, "asdfghjkl");
  return bytes.toString(CryptoJS.enc.Utf8);
};

server.listen(process.env.PORT || 5000, () => {
  console.log(`server is running on port ${process.env.PORT}`);
  // claimRoalty();
});

// cron.schedule("25 0 * * 2", () => {
//   console.log("cron");
//   claimRoalty();
// });

const claimRoalty = async () => {
  const WHOLE_NFT = 999;
  const connection = new web3.Connection(process.env.QUICK_NODE);
  const accounts = [];
  const nftamount = [];
  for (let i = 0; i < hash_list.length; i++) {
    const acc = await connection.getTokenLargestAccounts(
      new web3.PublicKey(hash_list[i])
    );
    const accInfo = await connection.getParsedAccountInfo(acc.value[0].address);
    let alreadyExists = false;
    for (let j = 0; j < accounts.length; j++) {
      if (accInfo.value.data.parsed.info.owner == accounts[j]) {
        nftamount[j]++;
        alreadyExists = true;
      }
    }
    if (alreadyExists) continue;
    accounts.push(accInfo.value.data.parsed.info.owner);
    nftamount.push(1);
    console.log(i);
  }
  console.log(accounts);
  console.log(nftamount);

  let PRIVATE_KEY_HOLDER = process.env.HOLDER_PRIV_KEY;
  let holderKeypair = web3.Keypair.fromSecretKey(
    bs58.decode(PRIVATE_KEY_HOLDER)
  );

  const holderbalance = await connection.getBalance(
    new web3.PublicKey(process.env.HOLDER_ADDR)
  );
  console.log("holderbalance", holderbalance);
  console.log(accounts.length);

  for (let k = 0; k < accounts.length; k++) {
    const connectionTest = new web3.Connection(
      process.env.QUICK_NODE,
      "confirmed"
    );
    console.log("nftamount", nftamount[k]);

    let tx = new web3.Transaction();
    tx.add(
      web3.SystemProgram.transfer({
        fromPubkey: holderKeypair.publicKey,
        toPubkey: new web3.PublicKey(accounts[k]),
        lamports: BigInt(
          parseFloat(((nftamount[k] / WHOLE_NFT) * holderbalance).toFixed())
        ),
      })
    );
    let blkhash = await (
      await connectionTest.getLatestBlockhash("finalized")
    ).blockhash;
    tx.recentBlockhash = blkhash;
    const sig1 = await web3.sendAndConfirmTransaction(connectionTest, tx, [
      holderKeypair,
    ]);
    console.log("sig1", sig1);
  }
};
