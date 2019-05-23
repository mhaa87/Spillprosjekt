const app = new Vue({
    el: '#app',
    data: {
        title: "Spillprosjekt",
        uri: "http://localhost:3030",
        curTab: "gameList", //'gameList', 'myGames', 'theme'
        user: {
            name: "",
            password: "",
            votes: [],
        },
        loggedIn: false,
        themeName: "Tema",
        newThemeName: "",
        newGame: {name: "", link: "", user: ""},
        gameList: [
            {name: "Spill 3", link: "http://www.google.com", user: "Tester", vote: 0},
            {name: "Spill 2", link: "http://www.google.com", user: "Tester2", vote: 0},
            {name: "Spill 1", link: "http://www.google.com", user: "Tester", vote: 0},
        ],
        gameScores: false,
    },

    computed:{
        
    },
   
    methods: {
        openLink(link){window.location.href = link;},

        async getGames(){
            this.gameList = (await axios.post(this.uri + "/getGames")).data;
            if(this.loggedIn) await this.getPlayerVotes();
        },
        async addGame(){
            if(this.newGame.link.length < 5) this.newGame.link = 'https://www.google.com/search?q=' + this.newGame.name;
            await axios.post(this.uri + "/addGame", this.newGame);
            this.newGame.name = "";
            this.newGame.link = "";
            this.getGames();
        },

        async getTheme(){
            this.themeName = (await axios.post(this.uri + "/getCurrentTheme")).data;
        },

        async newTheme(){
            var res = await axios.post(this.uri + "/newTheme", {'themeName': this.newThemeName});
            if(res.status === 200){
                this.themeName = this.newThemeName;
                this.newThemeName = "";
                this.gameScores = false;
                this.gameList = [];
            }
        },
        
        async getPlayerVotes(){
            this.setPlayerVotes((await axios.post(this.uri + "/getVotes", {"user": this.user.name})).data);
        },

        async vote(name, i, vote){
            if(!this.loggedIn) return;
            var res = await axios.post(this.uri + "/vote", {"user": this.user.name, "game": name, "vote": vote});
            if(res.status===200) this.$set(this.gameList[i], 'vote', vote);
        },

        async getScores(){
            this.gameScores = (await axios.post(this.uri + "/getScores")).data;
        },

        async login(){
            if(this.user.name.length < 1) return;
            var res = await axios.post(this.uri + "/login", {username: this.user.name, "password": this.user.password});
            if(res.status === 403) return; //wrong password
            if(res.status !== 200) return;
            this.loggedIn = true;
            this.newGame.user = this.user.name;
            this.getGames();
        },

        async deleteGame(name){
            var res = await axios.post(this.uri + "/deleteGame", {"name": name});
            if(res.status) await this.getGames();
        },

        async setTheme(){await axios.post(this.uri + "/setTheme", {"themeName": this.themeName});},
        
        setPlayerVotes(votes){
            for(var i=0; i<this.gameList.length; i++){
                this.$set(this.gameList[i], 'vote', votes[this.gameList[i].name] ? votes[this.gameList[i].name] : 0)
            }
        },

        logout(){
            this.loggedIn = false;
            this.user.name = "";
            this.user.password = "";
            this.user.votes = [];
            this.newGame.user = "";
            this.gameList.forEach(game => {game.vote = 0;});
        },
    },

    mounted() {
        this.getTheme();
        this.getGames();

        //For debug
        this.user = {name: "Tester", password: "password", votes: [],};
        this.login();
    }
})


