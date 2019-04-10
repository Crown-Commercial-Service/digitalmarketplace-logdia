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

browser.pageAction.onClicked.addListener((launching_tab) => {
  browser.tabs.executeScript(launching_tab.id, {"code": `(() => {
    if (window.latest_es_response && Array.isArray(window.latest_es_response.responses)) {
      try {
        response_json = window.latest_es_response.responses.map(response => JSON.parse(response)["responses"][0]);
      } catch (e) {
        window.alert("Sniffed data couldn't be parsed as JSON. Perhaps we sniffed the wrong thing?");
        return;
      }

      try {
        var len = response_json.map(r => r["hits"]["hits"].length).reduce((a, b) => a + b);
        if (len === 0) {
          window.alert("No log entries in this dataset. Can't diagram.");
          return;
        } else if (
          len < 100
          || window.confirm("This dataset consists of " + len + " log entries. Are you sure you want to diagram it?")
        ) {
          return response_json;
        }
      } catch (e) {
        window.alert("Sniffed data wasn't in expected format. Perhaps we sniffed the wrong thing?");
        return;
      }
    } else {
      window.alert("Couldn't find sniffed data to generate diagram with.");
    }
  })();`}).then((response_data) => {
    if (response_data[0] != null) {
      browser.tabs.create({
        "url": "/index.html"
      }).then((logdia_tab) => {
        var timed_out = false;
        setTimeout(() => {
            timed_out = true;
        }, 1000);

        var send_message = () => {
          if (timed_out) {
            browser.tabs.executeScript(launching_tab.id, {
              "code": `window.alert("Wasn't able to communicate with new logdia tab within a reasonable time. Giving up.");`
            });
          } else {
            browser.tabs.sendMessage(
              logdia_tab.id,
              {setSrcDataJson: JSON.stringify(response_data[0])}
            ).then((message) => {
              if (!(message && message.response === "srcDataJsonSet")) {
                send_message();
              }
            }).catch(send_message);
          }
        };
        send_message();
      });
    }
  });
});

browser.webNavigation.onDOMContentLoaded.addListener((details) => {
  browser.tabs.executeScript(details.tabId, {file: "browser-polyfill.js"});
  browser.tabs.executeScript(details.tabId, {
    "code": `(() => {
      var request_characteristic_string = request_body => {
        try {
          // while it's not guaranteed that a JSON.parse -> JSON.stringify will result in a deterministic key order,
          // it does seem to. revisit if this causes trouble.
          var decoded = JSON.parse(request_body.split("\\n", 2)[1]);
          decoded["size"] = null;  // size can genuinely vary between requests for the same kibana query. nullify it.
          return JSON.stringify(decoded);
        } catch (e) {
          return null;
        }
      };

      // set up content-script to maintain this easily accessible copy of most recently retrieved es response
      // based on custom events sent by the page script
      window.latest_es_response = null;
      document.addEventListener("kibanaesresponse", (event) => {
        if (event.detail && event.detail.response) {
          // we use the second line of the request as a "characteristic string" in an attempt to identify responses
          // that are part of the same query. if the characteristic string matches that of the existing es response
          // we've stored, we simply append it. else we completely replace it.
          var request_cstr = request_characteristic_string(event.detail.request || "");
          if (request_cstr !== null) {
            if (window.latest_es_response && window.latest_es_response.request_cstr === request_cstr) {
              window.latest_es_response.responses.push(event.detail.response);
            } else {
              window.latest_es_response = {
                "request_cstr": request_cstr,
                "responses": [event.detail.response]
              };
            }
          }
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
