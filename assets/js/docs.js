(function () {
  "use strict";

  var html = document.documentElement;
  var body = document.body;
  var baseurl = body.getAttribute("data-baseurl") || "";
  var currentLang = html.getAttribute("data-lang") || "en";

  /* 1. Theme toggle */
  var themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("snova-docs-theme", next);
    });
  }

  /* 2. Mobile sidebar */
  var navToggle = document.getElementById("mobile-nav-toggle");
  var sidebar = document.getElementById("doc-sidebar");
  var overlay = document.getElementById("sidebar-overlay");
  function setSidebarOpen(open) {
    if (!sidebar || !overlay || !navToggle) return;
    sidebar.classList.toggle("is-open", open);
    overlay.hidden = !open;
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      setSidebarOpen(!sidebar.classList.contains("is-open"));
    });
  }
  if (overlay) {
    overlay.addEventListener("click", function () { setSidebarOpen(false); });
  }

  /* 3. Table of Contents + scrollspy */
  var tocList = document.getElementById("doc-toc-list");
  var headings = Array.prototype.slice.call(
    document.querySelectorAll(".doc-content h2[id], .doc-content h3[id]")
  );
  if (tocList && headings.length > 0) {
    var tocLinks = [];
    headings.forEach(function (h) {
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      a.className = "doc-toc-link depth-" + (h.tagName === "H3" ? "3" : "2");
      tocList.appendChild(a);
      tocLinks.push({ id: h.id, el: a, heading: h });
    });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              tocLinks.forEach(function (item) {
                item.el.classList.toggle("is-active", item.id === entry.target.id);
              });
            }
          });
        },
        { rootMargin: "-70px 0px -75% 0px", threshold: 0 }
      );
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  /* 3b. Snova syntax highlighting (Rouge has no Snova lexer).
     Small hand-written tokenizer: comments, strings, numbers, keywords,
     type names and annotations. Keyword list matches the current compiler
     (Lex.snl classify + ScopeParse.snl classifyScope). */
  var snovaKeywords = /^(package|import|struct|class|interface|trait|enum|impl|implements|extends|func|method|public|private|static|let|var|return|if|else|while|for|in|break|continue|match|defer|pulsar|async|await|true|false|null)$/;
  var snovaTypes = /^(int|bool|string|unit)$/;
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function highlightSnova(src) {
    var out = "";
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*")|(@[A-Za-z_]\w*)|(\b\d+\b)|([A-Za-z_]\w*)|([\s\S])/g;
    var m;
    while ((m = re.exec(src)) !== null) {
      if (m[1]) out += '<span class="c">' + escapeHtml(m[1]) + "</span>";
      else if (m[2]) out += '<span class="s">' + escapeHtml(m[2]) + "</span>";
      else if (m[3]) out += '<span class="nd">' + escapeHtml(m[3]) + "</span>";
      else if (m[4]) out += '<span class="mi">' + m[4] + "</span>";
      else if (m[5]) {
        var w = m[5];
        if (snovaKeywords.test(w)) out += '<span class="k">' + w + "</span>";
        else if (snovaTypes.test(w)) out += '<span class="kt">' + w + "</span>";
        else if (/^[A-Z]/.test(w)) out += '<span class="nc">' + w + "</span>";
        else out += w;
      } else out += escapeHtml(m[6]);
    }
    return out;
  }
  /* kramdown emits <pre><code class="language-snova"> when Rouge has no lexer */
  Array.prototype.slice.call(document.querySelectorAll("pre > code.language-snova, .language-snova pre code")).forEach(function (code) {
    code.innerHTML = highlightSnova(code.textContent);
    code.parentNode.classList.add("highlight");
  });

  /* 4. Copy buttons on code blocks */
  var copyLabel = body.getAttribute("data-copy-label") || "Copy";
  var copiedLabel = body.getAttribute("data-copied-label") || "Copied";
  Array.prototype.slice.call(document.querySelectorAll(".doc-content pre")).forEach(function (pre) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy-btn";
    btn.textContent = copyLabel;
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = code ? code.innerText : pre.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = copiedLabel;
          setTimeout(function () { btn.textContent = copyLabel; }, 1600);
        });
      }
    });
    pre.appendChild(btn);
  });

  /* 5. Client-side search modal */
  var searchModal = document.getElementById("search-modal");
  var searchTrigger = document.getElementById("search-trigger");
  var searchInput = document.getElementById("search-input");
  var searchResults = document.getElementById("search-results");
  var searchEmpty = body.getAttribute("data-search-empty") || "No results.";
  var searchIndex = null;

  function loadSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    return fetch(baseurl + "/search.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        searchIndex = data;
        return data;
      })
      .catch(function () { return []; });
  }

  function renderResults(query) {
    if (!searchResults || !searchIndex) return;
    var q = query.trim().toLowerCase();
    var docs = searchIndex.filter(function (d) { return d.lang === currentLang; });
    var matches = q === ""
      ? docs
      : docs.filter(function (d) {
          return (
            d.title.toLowerCase().indexOf(q) !== -1 ||
            d.description.toLowerCase().indexOf(q) !== -1 ||
            d.content.toLowerCase().indexOf(q) !== -1
          );
        });

    searchResults.innerHTML = "";
    if (matches.length === 0) {
      var empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = searchEmpty;
      searchResults.appendChild(empty);
      return;
    }

    matches.slice(0, 12).forEach(function (item) {
      var a = document.createElement("a");
      a.className = "search-result-item";
      a.href = item.url;
      var title = document.createElement("span");
      title.className = "search-result-title";
      title.textContent = item.title;
      var snippet = document.createElement("span");
      snippet.className = "search-result-snippet";
      snippet.textContent = item.description;
      a.appendChild(title);
      a.appendChild(snippet);
      searchResults.appendChild(a);
    });
  }

  function openSearch() {
    if (!searchModal) return;
    searchModal.hidden = false;
    loadSearchIndex().then(function () {
      renderResults(searchInput ? searchInput.value : "");
    });
    if (searchInput) searchInput.focus();
  }

  function closeSearch() {
    if (!searchModal) return;
    searchModal.hidden = true;
  }

  if (searchTrigger) searchTrigger.addEventListener("click", openSearch);
  Array.prototype.slice.call(document.querySelectorAll("[data-search-close]")).forEach(function (el) {
    el.addEventListener("click", closeSearch);
  });
  if (searchInput) {
    searchInput.addEventListener("input", function () { renderResults(searchInput.value); });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && searchModal && !searchModal.hidden) {
      closeSearch();
    } else if (
      (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
      document.activeElement &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      openSearch();
    }
  });
})();
