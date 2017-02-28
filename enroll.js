var system = require('system');
var args = system.args;
var area = args[4],
	course = args[5];
var fs = require('fs');
var config = JSON.parse(fs.read('config.json', 'utf8'));

var steps = [];
var testindex = 0;
var loadInProgress = false;

var page = require("webpage").create(),
    url = "https://sa.ucla.edu/ro/classsearch/";

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36';
page.settings.javascriptEnabled = true;
page.settings.loadImages = false; 
phantom.cookiesEnabled = true;
phantom.javascriptEnabled = true;

steps = [
    function() {
        console.log("Step 1 - Open myUCLA home page");
        page.open(url, function(status) {});
    },
    function() {
        console.log('Step 2 - Populate and submit the login form');
        var rect = page.evaluate(function(config) {
            document.getElementById("logon").value = config.username;
            document.getElementById("pass").value = config.password;
            return document.forms[0].querySelector('button[name="_eventId_proceed"]').getBoundingClientRect();
        }, config);
        page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);

    },
    function() {
        console.log("Step 3 - Wait myUCLA to login user.");
    },
    function() {
        var loaded = page.evaluate(function() {
            var sel = document.getElementById("optSelectTerm");
            return sel;
        });
        if (!loaded) {
            testindex = 2;
            return;
        }

        console.log("Step 4 - Switch to term 17S");
        page.evaluate(function(config) {
            var sem = config.semester;
            var sel = document.getElementById("optSelectTerm");
            var opts = sel.options;
            for (var j = 0; j < opts.length; j++) {
                var opt = opts[j];
                console.log("Trying selector value ", opt.value);
                if (opt.value == sem) {
                    sel.selectedIndex = j;
                    break;
                }
            }

            $("#select_filter_subject").click();
        }, config);

        console.log("rendered select area");
    },
    function() {
        var check = page.evaluate(function() {
            var items = $("ul").filter(function(){
                return this.id.match(/ui-id-.*/);
            });
            return items[0].querySelectorAll("li").length;
        });
        console.log(check);
        if (check < 1) {
            testindex--;
            console.log("Not yet!");
        } else {
            console.log("YES!!");
            page.evaluate(function(){
                console.log("ready to trigger");
                var items = $("ul").filter(function(){
                    return this.id.match(/ui-id-.*/);
                });
                var tmp = items[0];
                //tmp.querySelector("li>a").click();

                var areas = tmp.querySelectorAll("li");
                for (var i = 0; i < areas.length; i++) {
                    var a = areas[i].querySelector("a");
                    console.log(a.innerHTML);
                    if (a.innerHTML.indexOf("COM SCI") !== -1) {
                        console.log("FOUND!!");
                        console.log(i);
                        areas[i].click();
                        break;
                    }
                }
                //document.getElementById("subject_area").value = "COM SCI";
                //$("#select_filter_catalog").click();
                /*console.log("ready to trigger again");
                var items = $("ul").filter(function(){
                    return this.id.match(/ui-id-+/);
                });
                var tmp = items[1];
                var courses = tmp.querySelectorAll("li");
                for (var i = 0; i < courses.length; i++) {
                    var a = courses[i].querySelector("a");
                    console.log(a.innerHTML);
                    if (a.innerHTML.indexOf("180") !== -1) {
                        console.log("found!!");
                        a.click();
                        break;
                    }
                }*/
            });
            page.render("selected area.png");
        }
    },
    function() {
        var check = page.evaluate(function() {
            var label = document.getElementById("catalog").value;
            return label;
        });
        console.log(check);
        if (!check) {
            testindex--;
            console.log("Not yet!");
        } else {
            console.log("YES AGAIN!!");
            page.evaluate(function(){
                //document.getElementById("catalog").value = "180";
                $("#btn_go").click();
            });
        }
    },
    function() {
        var check = page.evaluate(function() {
            var label = document.querySelector("#class-note");
            return label;
        });
        console.log(check);
        page.render("now.png");
        if (!check) {
            testindex--;
            console.log("Not loaded yet");
        } else {
            console.log("Course loaded");
        	page.render("Loaded.png");
            page.evaluate(function(){
                var items = $("div").filter(function(){
                    return this.id.match(/.*children/)
                });
                for(var lec in items) {
                    var status = lec.querySelector(".statusColumn>p").innerHTML();
                    console.log(status);
                }
            });
        }
    }
];

interval = setInterval(executeRequestsStepByStep, 500);

function executeRequestsStepByStep() {
    if (loadInProgress == false && typeof steps[testindex] == "function") {
        steps[testindex]();
        testindex++;
    }
    if (typeof steps[testindex] != "function") {
        console.log("test complete!");
        phantom.exit();
    }
}

/**
 * These listeners are very important in order to phantom work properly. Using these listeners, we control loadInProgress marker which controls, weather a page is fully loaded.
 * Without this, we will get content of the page, even a page is not fully loaded.
 */
page.onLoadStarted = function() {
    loadInProgress = true;
    console.log('Loading started');
};
page.onLoadFinished = function() {
    loadInProgress = false;
    console.log('Loading finished');
};
page.onConsoleMessage = function(msg) {
    var noise = /(^::.*$)|(regHelp)/;
    if (!noise.test(msg)) {
        console.log(msg);
    }
}

var forceTrigger = function(identity) {
    var rect = page.evaluate(function(s) {
        return document.querySelector(s).getBoundingClientRect();
    }, identity);
    console.log(rect.height, rect.width);
    page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height * 2);
}