const app = new Vue({
    el: '#app',
    data: {
        title: "Spillprosjekt",
        uri: "http://localhost:3030",
        curTab: "newVote", //'itemList', 'myitems', 'results', 'newVote'
        user: {
            name: "",
            password: "",
            votes: [],
        },
        loggedIn: false,
        suggestionsCloses: {date: "2019-05-31", time: "16:00"},
        votingCloses: {date: "2019-05-31", time: "23:00"},
        newVote: {
            title: "",
            items: [],
            votes: {},
            suggestionsCloses: {date: "2019-05-31", time: "16:00"},
            votingCloses: {date: "2019-05-31", time: "23:00"},
        },
        newItem: {name: "", link: "", user: ""},
        currentVote: 0,
        itemList: [
            {name: "Forslag 1", link: "http://www.google.com", user: "Tester", vote: 0},
            {name: "Forslag 2", link: "http://www.google.com", user: "Tester2", vote: 0},
            {name: "Forslag 3", link: "http://www.google.com", user: "Tester", vote: 0},
        ],
        itemScores: false,
    },

    computed:{
        suggestionsTimeLeft: function() {return this.getTimeLeft("Forslag", this.suggestionsCloses)},
        votingTimeLeft: function() {return this.getTimeLeft("Stemming", this.votingCloses)},
    },
   
    methods: {
        openLink(link){window.location.href = link;},

        getTimeLeft: function(name, closeDate) {
            var closeTime = this.parseDateString(closeDate);
            var timeLeft = Math.round((closeTime - Date.now())/(60*1000));
            var min = timeLeft % 60;
            var hours = Math.round(timeLeft / 60) % 24;
            var days = Math.round(timeLeft / (60*24));
            // console.log("days: " + days + " hours: " + hours + " min: " + min);
            if(days > 31) return (name + " avsluttes " + date + " kl." + time);
            if(days > 0) return (name + " avsluttes om " + days + " dager og " + hours + " timer");
            if(hours > 0) return (name + " avsluttes om " + hours + " timer og " + min + " minutter");
            if(min > 0) return (name + " avsluttes om " + min + " minutter");
            return (name + " er avsluttet");
        },

        parseDateString: function(closeDate){
            var year = closeDate.date.substring(0, 4);
            var month = closeDate.date.substring(5, 7);
            var day = closeDate.date.substring(8, 10);
            var hours = closeDate.time.substring(0, 2);
            var minutes = closeDate.time.substring(3, 5);
            return (new Date(year, (month-1), day, hours, minutes, 0, 0)).getTime();
        },

        async getVoteData(){
            let data = (await axios.post(this.uri + "/getVoteData", {"date": this.currentVote})).data;
            this.suggestionsCloses = data.suggestionsCloses;
            this.votingCloses = data.votingCloses;
            this.title = data.title;
            this.itemList = data.items;
            this.newVote.title = data.title;
            this.newVote.suggestionsCloses = data.suggestionsCloses;
            this.newVote.votingCloses = data.votingCloses;

        },

        async getItems(){
            this.itemList = (await axios.post(this.uri + "/getItems", {"date": this.currentVote})).data;
            if(this.loggedIn) await this.getPlayerVotes();
        },

        async addItem(){
            if(this.newItem.link.length < 5) this.newItem.link = 'https://www.google.com/search?q=' + this.newItem.name;
            await axios.post(this.uri + "/addItem", {'date': this.currentVote, 'item': this.newItem});
            this.newItem.name = "";
            this.newItem.link = "";
            this.getItems();
        },

        async getTitle(){
            this.title = (await axios.post(this.uri + "/getVoteTitle", {'date': this.currentVote})).data;
        },

        async getVoteDuration(){
            this.voteDuration = (await axios.post(this.uri + "/getVoteDuration", {'date': this.currentVote})).data;
        },

        async createNewVote(){
            var res = await axios.post(this.uri + "/newVote", {
                'title': this.newVote.title, 
                'suggestionsCloses': this.newVote.suggestionsCloses,
                'votingCloses': this.newVote.votingCloses,
            });
            if(res.status === 200){
                this.title = this.newVote.title;
                this.suggestionsCloses = this.newVote.suggestionsCloses;
                this.votingCloses = this.newVote.votingCloses;
                this.itemScores = false;
                this.itemList = [];
                this.currentVote = (await axios.post(this.uri + "/getCurrentVote")).data;
            }
        },
      
        async updateVote(){
            var res = await axios.post(this.uri + "/updateVote", {'date': this.currentVote, 'data': this.newVote});
             if(res.status === 200){
                this.title = this.newVote.title;
                this.suggestionsCloses = this.newVote.suggestionsCloses;
                this.votingCloses = this.newVote.votingCloses;
            }
        },
        
        async getPlayerVotes(){
            this.setPlayerVotes((await axios.post(this.uri + "/getVotes", {"date": this.currentVote, "user": this.user.name})).data);
        },

        async vote(name, i, vote){
            if(!this.loggedIn) return;
            var res = await axios.post(this.uri + "/vote", {"date": this.currentVote, "user": this.user.name, "item": name, "vote": vote});
            if(res.status===200 && res.data.status !== false) this.$set(this.itemList[i], 'vote', vote);
        },

        async getScores(){
            this.itemScores = (await axios.post(this.uri + "/getScores", {"date": this.currentVote})).data;
        },

        async login(){
            if(this.user.name.length < 1) return;
            var res = await axios.post(this.uri + "/login", {username: this.user.name, "password": this.user.password});
            if(res.status === 403) return; //wrong password
            if(res.status !== 200) return;
            this.loggedIn = true;
            this.newItem.user = this.user.name;
            this.getItems();
        },

        async deleteItem(name){
            var res = await axios.post(this.uri + "/deleteItem", {"date": this.currentVote, "name": name});
            if(res.status) await this.getItems();
        },

        async setTheme(){await axios.post(this.uri + "/setTheme", {"themeName": this.themeName});},
        
        setPlayerVotes(votes){
            for(var i=0; i<this.itemList.length; i++){
                this.$set(this.itemList[i], 'vote', votes[this.itemList[i].name] ? votes[this.itemList[i].name] : 0)
            }
        },

        logout(){
            this.loggedIn = false;
            this.user.name = "";
            this.user.password = "";
            this.user.votes = [];
            this.newitem.user = "";
            this.itemList.forEach(item => {item.vote = 0;});
        },

        async mountApp(){
            this.currentVote = (await axios.post(this.uri + "/getCurrentVote")).data;
            await this.getVoteData();
            //For debug
            this.user = {name: "Tester", password: "password", votes: [],};
            await this.login();
        },
    },

    mounted() {
        this.mountApp();
    }
})


