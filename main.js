/*eslint-env amd*/

var fs = require('fs');
var process = require("child_process");
var spawn = process.spawn;
var execFile = process.execFile;

var steps = [];
var testindex = 0;
var loadInProgress = false;
var config = JSON.parse(fs.read('config.json', 'utf8'));
var courses = config.courses.slice(0);

var page = require("webpage").create(),
    url = "https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx";

var trigger = function(identity) {
    var rect = page.evaluate(function(s) {
        return document.querySelector(s).getBoundingClientRect();
    }, identity);
    page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);
}

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36';
page.settings.javascriptEnabled = true;
page.settings.loadImages = false; 
phantom.cookiesEnabled = true;
phantom.javascriptEnabled = true;

console.log('All settings loaded, start with execution');

page._render = function(file) {
    //page.render(file);
    //page.render("watch.png");
    console.log("Updated watch.png");
}

steps = [
    function() {
        console.log("Step 1 - Open myUCLA home page");
        page.open(url, function(status) {});
    },
    function() {
        console.log('Step 2 - Populate and submit the login form');
        //page._render("startPage.png");
        var rect = page.evaluate(function(config) {
            document.getElementById("logon").value = config.username;
            document.getElementById("pass").value = config.password;
            return document.forms[0].querySelector('button[name="_eventId_proceed"]').getBoundingClientRect();
        }, config);
        page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);
        //page._render('Logon.png');

    },
    function() {
        console.log("Step 3 - Wait myUCLA to login user.");
        //page._render("waitLogon.png");
    },
    function() {
        var loaded = page.evaluate(function() {
            var sel = document.getElementById("ctl00_MainContent_termSessionChooser_TermChooser");
            return sel;
        });
        if (!loaded) {
            testindex = 2;
            return;
        }

        console.log("Step 4 - Switch to term 17S");
        //page._render("beforeSelection.png");
        page.evaluate(function(config, courses) {
            var sem = config.semester;
            var sel = document.getElementById("ctl00_MainContent_termSessionChooser_TermChooser");
            var opts = sel.options;
            for (var j = 0; j < opts.length; j++) {
                var opt = opts[j];
                console.log("Trying selector value ", opt.value);
                if (opt.value == sem) {
                    sel.selectedIndex = j;
                    break;
                }
            }
            var evt = document.createEvent("HTMLEvents");
            evt.initEvent("change", false, true);
            sel.dispatchEvent(evt);
        }, config, courses);
    },
    function() {
        var transform = function(str) {
            var match = (/^(.).*(\d\d)$/).exec(str);
            return match[2] + match[1].toUpperCase();
        }
        var label = page.evaluate(function() {
            var label = document.querySelector(".term_display").innerText;
            return label;
        });
        var loaded = transform(label) === config.semester;
        if (!loaded) {
            testindex--;
            //console.log("Not loaded yet")
        }
    },
    function() {
        console.log("Step 5 - Load course info");
        //page._render('beforeQuery2.png');
        poll();
        console.log("Done")
    }, 
    function() {
        console.log("Another round --- Wait for it");
        setTimeout(function() {
            //testindex = 3;
            //page.reload();
        }, 180000);
        
    },
];


interval = setInterval(executeRequestsStepByStep, 500);

function executeRequestsStepByStep() {
    if (loadInProgress == false && typeof steps[testindex] == "function") {
        //console.log("step " + (testindex + 1));
        steps[testindex]();
        testindex++;
    }
    if (typeof steps[testindex] != "function") {
        //console.log("test complete!");
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


/**
 * Get course info and send email / enroll for the user 
 */

function getCourseDOM(list, course, enroll) {
    var result = null;
    var DOM = null;
    try {
        for (var i = 0; i < list.length; i++) {
            var d = list[i];
            var classname = d.nextElementSibling.dataset.classname;
            if (classname.indexOf(course) !== -1) {
                result = d;
                break;
            }
        }
        result = result.querySelectorAll("tbody")[1];
        //DOM = result;
        result = result.children[0];
        result = result.children[2].childNodes[1].textContent;
        //DOM = DOM.querySelectorAll(".mobilemenupanel")[1];
        //DOM = DOM.querySelectorAll(".menuitem")[2];
    } catch (_) {
        console.log("Error!");
        return null;
    }

    if (enroll) {
        console.log(DOM)
        console.log("enrolling "+course);
        /*var links = DOM.getElementByTagName("a");
        for (var i = 0; i < links.length; i++) {
          console.log("visiting "+links[i].textContent);
          if (links[i].textContent == "Enroll") {
              console.log("triggered");
              links[i].trigger();
          }
        }*/
        DOM.trigger();
    } else {
    return result;
    }
}


function getCourse(getCourseDOM, courses) {
    var resultList = [];
    var divlist = document.querySelectorAll(".iweBodyTable");
    var list = [].slice.call(divlist, 0);

    for (var i = 0; i < courses.length; i++) {
        var result = getCourseDOM(list, courses[i], false);
        if (result === null) {
            console.log("null");
            continue;
        }
        console.log("result = ", result);

        var status = 0;
        if (result.toLowerCase().indexOf("full") === -1 &&
            result.toLowerCase().indexOf("closed") === -1) {
            status = 1;
        }

        if (status !== 0) {
            //new spots appear
            console.log("NEW SPOT !!!!!!!!!!!!!!!!!!!! ");
            resultList.push(courses[i]);
        }
    }

    return resultList;
}

function poll() {
    var result = page.evaluate(getCourse, getCourseDOM, config.courses);
    if (result.length > 0) {
        //sendEmail(result);
        enroll();
    }
    /*for (var i = 0; i < result.length; i++) {
      var course = result[i];
      page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js', function() {
      page.evaluate(function(course, getCourseDOM){
          console.log("try enrolling " + course);
          var divlist = document.querySelectorAll(".iweBodyTable");
          var list = [].slice.call(divlist, 0);
          getCourseDOM(list, course, true);
      }, course, getCourseDOM);
      });
    }
    console.log(result);*/
}

function sendEmail(name) {
    function toQueryString(obj) {
        var str = '';
        for (var key in obj) {
            str += key + '=' + encodeURIComponent(obj[key]) + '&';
        }
        return str.slice(0, str.length - 1);
    }

    var body = {
        "from": "Mailgun Sandbox <postmaster@sandbox64b3024307024ea38e0944d3e7d40474.mailgun.org>",
        "to": config.firstname + " " + config.lastname + " <" + config.email + ">",
        "subject": "Hello ",
        "text": "Hi, \n This is your course scanner service to remind you that a new spot has shown up " +
            "on your courses " + name +
            ". Hope you go for it real quick ! " +
            "\n\n Best, \n Your faithful Snatcher"
    };

    var gun = require('webpage').create(),
        server = "https://api:key-c61f93d8f12742dab476c0a77fe6af12@api.mailgun.net/v3/sandbox64b3024307024ea38e0944d3e7d40474.mailgun.org/messages",
        data = toQueryString(body);

    gun.onConsoleMessage = function(msg, lineNum, sourceId) {
        console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
    };

    console.log("data : " + data);

    gun.open(server, 'POST', data, function(status) {
        if (status === 'success') {
            console.log("Email successfully sent");
        } else {
            console.log("Email not sent.");
        }
    });

}

function enroll() {
    console.log("Entering Enroll");
    execFile("phantomjs", ["enroll.js", "COM SCI", "180"], null, function (err, stdout, stderr) {
        //console.log("execFileSTDOUT:", JSON.stringify(stdout))
        //console.log("execFileSTDERR:", JSON.stringify(stderr))
        //uncomment if you want to see the ugly unformatted output
    })
}
