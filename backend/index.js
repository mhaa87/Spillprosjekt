const Koa = require('koa');
const cors = require('koa-cors');
const Router = require('koa-router');
const BodyParser = require("koa-bodyparser");
const logger = require('koa-logger');
const MongoClient = require('mongodb').MongoClient;

const uri = 'mongodb+srv://testuser:testpassword@funkweb-cv-portal-hvkag.gcp.mongodb.net/test?retryWrites=true'
const client = new MongoClient(uri, {useNewUrlParser: true});
const app = new Koa();
const router = new Router();
const dbName = "Spillprosjekt";
var databaseConnected = false;
var userCollection;
var currentVote;
var votingCollection;

app.use(logger());
app.use(cors());
app.use(BodyParser());

router.use("/", checkConnection);
router.post("/newVote", newVote);
router.post("/updateVote", updateVote);
router.post("/getCurrentVote", getCurrentVote);
router.post("/getVoteData", getVoteData);
router.post("/getItems", getItems);
router.post("/addItem", addItem);
router.post("/deleteItem", deleteItem);
router.post("/getVoteTitle", getVoteTitle);
router.post("/getVoteDuration", getVoteDuration);
router.post("/login", login);
router.post("/vote", vote);
router.post("/getVotes", getVotes);
router.post("/getScores", getScores);

async function checkConnection(ctx, next){
    if(databaseConnected){await next(); return};
    await client.connect().then(async function(){
        userCollection = await client.db(dbName).collection("Brukere");
        currentVote = await client.db(dbName).collection("SisteAvstemning");
        votingCollection = await client.db(dbName).collection("Avstemninger");
        databaseConnected = true;
        await next();
    }).catch((err) => {ctx.body = {status: false, msg: "Database connection error"};});
}

async function login(ctx){
    var user = await userCollection.findOne({"name": ctx.request.body.username});
    if(user === null){
        user = {"name": ctx.request.body.username, "votes": {}};
        await userCollection.insertOne(user);
        ctx.body = user;
        return;
    }
    if(ctx.request.body.password !== user.password) {ctx.status = 403; return;}
    ctx.body = user;
}

async function getCurrentVote(ctx){ctx.body = (await currentVote.findOne({})).date;};

async function getVoteData(ctx){
    var data = await votingCollection.findOne({date: ctx.request.body.date});
    data.votes = {};
    ctx.body = data;
}

async function getVoteTitle(ctx){ctx.body = (await votingCollection.findOne({date: ctx.request.body.date})).title;}
async function getVoteDuration(date){return (await votingCollection.findOne({'date': ctx.request.body.date})).voteDuration;}

async function newVote(ctx){
    let time = (new Date()).getTime();
    await currentVote.updateOne({}, {$set:{"date": time}});
    await votingCollection.insertOne({
        'date' : time,
        'title': ctx.request.body.title, 
        'items': [], 
        'votes': {}, 
        'suggestionsCloses': ctx.request.body.suggestionsCloses,
        'votingCloses': ctx.request.body.votingCloses,
    });
    ctx.body = {status: true};
}

async function updateVote(ctx){
    await votingCollection.updateOne({'date': ctx.request.body.date}, {$set:{
        'title': ctx.request.body.data.title,
        'suggestionsCloses': ctx.request.body.data.suggestionsCloses,
        'votingCloses': ctx.request.body.data.votingCloses
    }});
    ctx.body = {status: true};
}

async function addItem(ctx){
    if(!(await suggestionsOpen(ctx.request.body.date))) {ctx.body = {status: false}; return}
    await votingCollection.updateOne({date: ctx.request.body.date}, {
        $push: {'items': ctx.request.body.item}
    });
    ctx.body = {status: true};
}

async function deleteItem(ctx){
    if(!(await suggestionsOpen(ctx.request.body.date))) {ctx.body = {status: false}; return}
    var res = await votingCollection.updateOne({date: ctx.request.body.date}, {
        $pull: {items: {'name': ctx.request.body.name}}
    });
    if(!res.acknowledged){ctx.body = {status: false, msg: "error deleting document"};return};
}

async function getItems(ctx){ctx.body = (await votingCollection.findOne({'date': ctx.request.body.date})).items;}

async function vote(ctx){
    if(!(await votingOpen(ctx.request.body.date))) {ctx.body = {status: false}; return}
    ctx.body = await votingCollection.updateOne({date: ctx.request.body.date}, {
        $set:{['votes.' + ctx.request.body.user + "." + ctx.request.body.item]: ctx.request.body.vote}
    });
}

async function getVotes(ctx){
    var res = (await votingCollection.findOne({date: ctx.request.body.date})).votes[ctx.request.body.user];
    ctx.body = (res) ? res : [];
}

async function getScores(ctx){ctx.body = await calculateScores(ctx.request.body.date);}

async function calculateScores(date){
    let voting = await votingCollection.findOne({'date': date});
    var votes = {};
    voting.items.forEach(item => {votes[item.name] = 0;});
    Object.values(voting.votes).forEach(userVotes => {
        Object.keys(userVotes).forEach(item => {
            if(votes[item] !== undefined) votes[item] += userVotes[item];
        });
    });
    var results = [];
    Object.keys(votes).forEach(item => results.push({"name": item, "votes": votes[item]}));
    results.sort((a, b) => {return b.votes - a.votes});
    return results;
}

async function suggestionsOpen(date){
    return (new Date().getTime()) < parseDateString((await votingCollection.findOne({'date': date})).suggestionsCloses);
}

async function votingOpen(date){
    return (new Date().getTime()) < parseDateString((await votingCollection.findOne({'date': date})).votingCloses);
}

function parseDateString(closeDate){
    var year = closeDate.date.substring(0, 4);
    var month = closeDate.date.substring(5, 7);
    var day = closeDate.date.substring(8, 10);
    var hours = closeDate.time.substring(0, 2);
    var minutes = closeDate.time.substring(3, 5);
    return (new Date(year, (month-1), day, hours, minutes, 0, 0)).getTime();
}

app.use(router.routes()).use(router.allowedMethods());
app.listen(3030);
console.log("listening on port 3030");