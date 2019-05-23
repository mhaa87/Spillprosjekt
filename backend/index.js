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
var themeCollection;

app.use(logger());
app.use(cors());
app.use(BodyParser());

router.use("/", checkConnection);
router.post("/newTheme", newTheme);
router.post("/getGames", getGames);
router.post("/addGame", addGame);
router.post("/deleteGame", deleteGame);
router.post("/getCurrentTheme", getCurrentThemeName);
router.post("/login", login);
router.post("/vote", vote);
router.post("/getVotes", getVotes);
router.post("/getScores", getScores);

async function checkConnection(ctx, next){
    if(databaseConnected){await next(); return};
    await client.connect().then(async function(){
        userCollection = await client.db(dbName).collection("Brukere");
        themeCollection = await client.db(dbName).collection("Themes");
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

async function getCurrentThemeID(){return (await themeCollection.findOne({})).currentTheme};

async function getCurrentThemeObject(){
    let themesObj = await themeCollection.findOne({});
    return themesObj.themes[themesObj.currentTheme];
}

async function getCurrentThemeName(ctx){
    let themesObj = await themeCollection.findOne({});
    ctx.body = themesObj.themes[themesObj.currentTheme].name;
}

async function newTheme(ctx){
    let time = (new Date()).getTime();
    await themeCollection.updateOne({}, {$set:{"currentTheme": time}});
    await themeCollection.updateOne({}, {$set:{["themes." + time]: {'name': 'newTheme', 'games': [], 'votes': {}, 'suggestionsOpen': false, 'votingOpen': false}}});
    ctx.body = {status: true};
}

async function addGame(ctx){
    await themeCollection.updateOne({}, {
        $push: {['themes.' + (await getCurrentThemeID()) + '.games']: ctx.request.body}
    });
    ctx.body = {status: true};
}

async function deleteGame(ctx){
    var res = await themeCollection.updateOne({}, {$pull: {['themes.' + (await getCurrentThemeID()) + '.games']: {'name': ctx.request.body.name}}});
    if(!res.acknowledged){ctx.body = {status: false, msg: "error deleting document"} ;return};
}

async function getGames(ctx){ctx.body = (await getCurrentThemeObject()).games;}

async function vote(ctx){
    ctx.body = await themeCollection.updateOne({}, {
        $set:{['themes.' + (await getCurrentThemeID()) + '.votes.' + ctx.request.body.user + "." + ctx.request.body.game]: ctx.request.body.vote}
    });
}

async function getVotes(ctx){
    var res = (await getCurrentThemeObject()).votes[ctx.request.body.user];
    ctx.body = (res) ? res.votes : [];
}

async function getAllVotes(ctx){
    var allVotes = {};
    await userCollection.findMany({}).toArray().forEach(user => {
        allVotes[user.name] = user.votes;
    });
    ctx.body = allVotes;
}

async function getScores(ctx){ctx.body = await calculateScores();}

async function calculateScores(){
    let theme = await getCurrentThemeObject();
    var votes = {};
    theme.games.forEach(game => {votes[game.name] = 0;});
    Object.values(theme.votes).forEach(userVotes => {
        Object.keys(userVotes).forEach(game => {
            if(votes[game]) votes[game] += userVotes[game];
        });
    });
    var results = [];
    Object.keys(votes).forEach(game => results.push({"game": game, "votes": votes[game]}));
    results.sort((a, b) => {return b.votes - a.votes});
    return results;
}

app.use(router.routes()).use(router.allowedMethods());
app.listen(3030);
console.log("listening on port 3030");