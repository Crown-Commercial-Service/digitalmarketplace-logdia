function updatePageAction(tab) {
  browser.tabs.executeScript(tab.id, {"code": "1"}).then(() => {
    browser.pageAction.show(tab.id);
  }).catch(() => {
    browser.pageAction.hide(tab.id);
  });
}

// call updatePageAction for all tabs on each load
browser.tabs.query({}).then((tabs) => {
  for (let tab of tabs) {
    updatePageAction(tab);
  }
});

// call updatePageAction when tabs are updated
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  updatePageAction(tab);
});

browser.pageAction.onClicked.addListener((tab) => {
  browser.tabs.executeScript(tab.id, {"code": `(() => {
    if (window.latest_es_response) {
      try {
        response_json = JSON.parse(window.latest_es_response);
      } catch (e) {
        window.alert("Sniffed data couldn't be parsed as JSON. Perhaps we sniffed the wrong thing?");
        return;
      }

      try {
        var len = response_json["responses"][0]["hits"]["hits"].length;
        if (len === 0) {
          window.alert("No log entries in this dataset. Can't diagram.");
          return;
        } else if (
          len < 100
          || window.confirm("This dataset consists of " + len + " log entries. Are you sure you want to diagram it?")
        ) {
          return response_json["responses"][0];
        }
      } catch (e) {
        window.alert("Sniffed data wasn't in expected format. Perhaps we sniffed the wrong thing?");
        return;
      }
    }
  })();`}).then((response_data) => {
    if (response_data[0] != null) {
      browser.tabs.create({
        "url": "/index.html"
      }).then((tab) => {
        browser.tabs.executeScript(tab.id, {
          "code": `(() => {
            document.querySelector("#src-data-form").elements["src-data-json"].value = JSON.stringify(${JSON.stringify(response_data[0])});
          })();`,
        });
      });
    }
  });
});

browser.webNavigation.onDOMContentLoaded.addListener((details) => {
  browser.tabs.executeScript(details.tabId, {
    "code": `(() => {
      // set up content-script to maintain this easily accessible copy of most recently retrieved es response
      // based on custom events sent by the page script
      window.latest_es_response = null;
      document.addEventListener("kibanaesresponse", (event) => {
        if (event.detail != null) {
          window.latest_es_response = event.detail;
        }
      });

      // set up our XMLHttpRequest monkeypatcher to run in page-context
      var s = document.createElement('script');
      s.src = "${browser.runtime.getURL('xhr-monkeypatcher.js')}";
      s.onload = function() {
        // tidy ourselves up - no need to be left around
        this.remove();
      };
      (document.head || document.documentElement).appendChild(s);
    })();`,
    "runAt": "document_end"
  })
}, {
  "url": [{"urlPrefix": "https://kibana.logit.io/"}]
});
