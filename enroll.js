var system = require('system');
var args = system.args;
/*var area = args[4],
	course = courseParser(args[5]);*/
var area = "COM SCI",
    course = courseParser("180");
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
        //console.log("Step 1 - Open myUCLA home page");
        console.log("check parameters:");
        console.log("area: "+area);
        console.log("course: "+course);
        page.open(url, function(status) {});
    },
    function() {
        //console.log('Step 2 - Populate and submit the login form');
        var rect = page.evaluate(function(config) {
            document.getElementById("logon").value = config.username;
            document.getElementById("pass").value = config.password;
            return document.forms[0].querySelector('button[name="_eventId_proceed"]').getBoundingClientRect();
        }, config);
        page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);

    },
    function() {
        //console.log("Step 3 - Wait myUCLA to login user.");
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

        //console.log("Step 4 - Switch to term 17S");
        page.evaluate(function(config) {
            var sem = config.semester;
            var sel = document.getElementById("optSelectTerm");
            var opts = sel.options;
            for (var j = 0; j < opts.length; j++) {
                var opt = opts[j];
                //console.log("Trying selector value ", opt.value);
                if (opt.value == sem) {
                    sel.selectedIndex = j;
                    break;
                }
            }

            $("#select_filter_subject").click();

            //console.log("ready to trigger");
            var items = $("ul").filter(function(){
                return this.id.match(/ui-id-.*/);
            });
            var tmp = items[0];
            tmp.querySelector("li>a").click();
        }, config);

        //console.log("rendered select area");
    },
    function() {
        var check = page.evaluate(function() {
            var label = document.getElementById("div_catalog").style.display;
            return label;
        });
        page.render("click1.png");
        if (check != "block") {
            testindex--;
            //console.log("Not yet!");
        } else {
            //console.log("YES!!");
            page.evaluate(function(area){
                document.getElementById("select_filter_subject").value = area;
                document.getElementById("subject_area").value = area;
                $("#select_filter_catalog").click();
                //console.log("ready to trigger again");
                var items = $("ul").filter(function(){
                    return this.id.match(/ui-id-.*/);
                });
                var tmp = items[1];
                tmp.querySelector("li>a").click();
            }, area);
        }
    },
    function() {
        var check = page.evaluate(function() {
            var label = document.getElementById("catalog").value;
            return label;
        });
        page.render("click2.png");
        if (!check) {
            testindex--;
            //console.log("Not yet!");
        } else {
            //console.log("YES AGAIN!!");
            page.evaluate(function(course){
                document.getElementById("select_filter_catalog").value = course;
                document.getElementById("catalog").value = course;
                $("#btn_go").click();
            }, course);
        }
    },
    function() {
        var check = page.evaluate(function() {
            var label = document.querySelector("#class-note");
            return label;
        });
        page.render("now.png");
        if (! check) {
            testindex--;
            //console.log("Not loaded yet");
        } else {
            //console.log("Course loaded");
        	page.render("Loaded.png");
            page.evaluate(function(){
                var items = $("div").filter(function(){
                    return this.id.match(/.*children/)
                });
                for (var i = 0; i < items.length; i++) {
                    var lec = items[i];
                    var status = lec.querySelector(".statusColumn>p").innerText;
                    //console.log(status);
                    if (status.toLowerCase().indexOf("full") === -1 &&
                        status.toLowerCase().indexOf("closed") === -1) {
                        lec.querySelector(".enrollColumn>input").click();
                    }
                }
            });
            page.render("enroll.png");
        }
    },
    function() {
        var check = page.evaluate(function(){
            var items = $("div").filter(function(){
                return this.id.match(/.*children/)
            });
            for(var i = 0; i < items.length; i++) {
                var lec = items[i];
                var status = lec.querySelector(".statusColumn>p").innerText;
                //console.log(status);
                if (status.toLowerCase().indexOf("full") === -1 &&
                    status.toLowerCase().indexOf("closed") === -1) {
                    var discussions = lec.querySelector(".secondarySection");
                    if (discussions)
                        discussions = discussions.querySelectorAll(".secondary-row");
                    else
                        discussions = null;

                    if (discussions === null) {
                        return false;
                    }

                    //Check if there're any "OPEN" sections
                    var enrolled = false;
                    for(var j = 0; j < discussions.length; i++) {
                        var dis = discussions[i];
                        var status = dis.querySelector(".statusColumn>p").innerText;
                        if (status.toLowerCase().indexOf("open") !== -1) {
                            dis.querySelector(".enrollColumn>input").click();
                            enrolled = true;
                            break;
                        }
                    }
                    if (enrolled)
                        break;
                    for(var j = 0; j < discussions.length; i++) {
                        var dis = discussions[i];
                        var status = dis.querySelector(".statusColumn>p").innerText;
                        if (status.toLowerCase().indexOf("waitlist") !== -1) {
                            dis.querySelector(".enrollColumn>input").click();
                            enrolled = true;
                            break;
                        }
                    }
                    if (! enrolled) {
                        //console.log("There must be something seriously wrong!");
                        phantom.exit();
                    }
                }
            }
            return true;
        });
        page.render("now.png");
        if (! check) {
            testindex--;
            //console.log("Not loaded yet");
        } else {
            //console.log("ready to enroll");
            
        }
    },
    function() {
        var check = page.evaluate(function() {
            var enrollBtn = $("#btn_Enroll");
            var enrollPanel = $("div.row-fluid.enroll")[0];
            if ((!enrollBtn) || (!enrollPanel)) {
                //console.log(enrollPanel);
                return false;
            }
            //console.log("found enroll button and panel!")
            var checkBoxes = enrollPanel.querySelectorAll("input[type='checkbox']");
            for (var i = 0; i < checkBoxes.length; i++) {
                checkBoxes[i].click();
            }
            enrollBtn.click();
            return true;
        });
        page.render("now.png");
        if (! check) {
            testindex--;
            //console.log("enroll not loaded yet");
        } else {
            //console.log("Finished action");
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
        //console.log("enroll complete!");
        phantom.exit();
    }
}

/**
 * These listeners are very important in order to phantom work properly. Using these listeners, we control loadInProgress marker which controls, weather a page is fully loaded.
 * Without this, we will get content of the page, even a page is not fully loaded.
 */
page.onLoadStarted = function() {
    loadInProgress = true;
    //console.log('Loading started');
};
page.onLoadFinished = function() {
    loadInProgress = false;
    //console.log('Loading finished');
};
page.onConsoleMessage = function(msg) {
    var noise = /(^::.*$)|(regHelp)/;
    if (!noise.test(msg)) {
        //console.log(msg);
    }
}

function courseParser(s) {
    var isM = false;
    var MorCM = "";
    if (s.indexOf("M") !== -1) {
        isM = true;
        MorCM = s.slice(0, s.indexOf('M')+1);
        s = s.slice(s.indexOf('M')+1, s.length);
    }
    while(s.match(/\d/g).length < 4) {
        s = "0"+s;
    }
    if (isM) {
        return s+"  "+MorCM;
    } else {
        return s;
    }
}