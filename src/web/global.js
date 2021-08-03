/* global stuff here */

(function () {
  // borrowed from https://github.com/HubSpot/humanize
  function compactInteger(input, decimals = 0) {
    decimals = Math.max(decimals, 0);
    const number = parseInt(input, 10);
    const signString = number < 0 ? "-" : "";
    const unsignedNumber = Math.abs(number);
    const unsignedNumberString = String(unsignedNumber);
    const numberLength = unsignedNumberString.length;
    const numberLengths = [13, 10, 7, 4];
    const bigNumPrefixes = ["T", "B", "M", "k"];

    // small numbers
    if (unsignedNumber < 1000) {
      return `${signString}${unsignedNumberString}`;
    }

    // really big numbers
    if (numberLength > numberLengths[0] + 3) {
      return number.toExponential(decimals).replace("e+", "x10^");
    }

    // 999 < unsignedNumber < 999,999,999,999,999
    let length;
    for (let i = 0; i < numberLengths.length; i++) {
      const _length = numberLengths[i];
      if (numberLength >= _length) {
        length = _length;
        break;
      }
    }

    const decimalIndex = numberLength - length + 1;
    const unsignedNumberCharacterArray = unsignedNumberString.split("");

    const wholePartArray = unsignedNumberCharacterArray.slice(0, decimalIndex);
    const decimalPartArray = unsignedNumberCharacterArray.slice(
      decimalIndex,
      decimalIndex + decimals + 1
    );

    const wholePart = wholePartArray.join("");

    // pad decimalPart if necessary
    let decimalPart = decimalPartArray.join("");
    if (decimalPart.length < decimals) {
      decimalPart += `${Array(decimals - decimalPart.length + 1).join("0")}`;
    }

    let output;
    if (decimals === 0) {
      output = `${signString}${wholePart}${
        bigNumPrefixes[numberLengths.indexOf(length)]
      }`;
    } else {
      const outputNumber = Number(`${wholePart}.${decimalPart}`).toFixed(
        decimals
      );
      output = `${signString}${outputNumber}${
        bigNumPrefixes[numberLengths.indexOf(length)]
      }`;
    }
    return output;
  }

  function getSearchParamByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  function getFilters() {
    const _filters = getSearchParamByName("filters");
    let filters = [];
    if (_filters && _filters.length > 0) {
      filters = JSON.parse(atob(decodeURIComponent(_filters)));
    }
    return filters;
  }

  function getSearchTerm() {
    const term = getSearchParamByName("term");
    return term || "";
  }

  function exitFiltering() {
    const path = `${window.location.origin}/`;
    window.location.href = path;
  }

  function navigateToFilters(filtersArray) {
    let res;
    if (filtersArray) {
      res = btoa(JSON.stringify(filtersArray));
    }
    const path = `${window.location.origin}/search${
      (res && `?filters=${res}`) || ""
    }`;
    window.location.href = path;
  }

  function navigateToSearchTerm(term) {
    const path = `${window.location.origin}/search${
      (term && `?term=${term}`) || ""
    }`;
    window.location.href = path;
  }

  function hydrateIndexTags() {
    const tags = document.querySelectorAll(".tag.clickable");
    if (tags && tags.length) {
      tags.forEach((tag) => {
        tag.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const name = tag.getAttribute("data-tag");
          const color = tag.getAttribute("data-color");
          const border = tag.getAttribute("data-border");
          const background = tag.getAttribute("data-background");
          const filterData = [
            {
              t: name,
              c: color,
              b: border,
              bg: background,
            },
          ];
          navigateToFilters(filterData);
          return false;
        });
      });
    }
  }

  function createTag(tag, background, color, border, remove) {
    const element = document.createElement("span");
    element.classList = `tag clickable tag-${tag}`;
    element.style = `background-color:${background};color:${color}`;
    const text = document.createElement("span");
    text.innerHTML = tag;
    element.appendChild(text);
    if (remove) {
      const icon = document.createElement("span");
      icon.classList = "icon";
      icon.innerHTML = `<svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="times" class="svg-inline--fa fa-times fa-w-10" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path fill="currentColor" d="M207.6 256l107.72-107.72c6.23-6.23 6.23-16.34 0-22.58l-25.03-25.03c-6.23-6.23-16.34-6.23-22.58 0L160 208.4 52.28 100.68c-6.23-6.23-16.34-6.23-22.58 0L4.68 125.7c-6.23 6.23-6.23 16.34 0 22.58L112.4 256 4.68 363.72c-6.23 6.23-6.23 16.34 0 22.58l25.03 25.03c6.23 6.23 16.34 6.23 22.58 0L160 303.6l107.72 107.72c6.23 6.23 16.34 6.23 22.58 0l25.03-25.03c6.23-6.23 6.23-16.34 0-22.58L207.6 256z"></path></svg>`;
      element.appendChild(icon);
    }
    return element;
  }

  // wire up tiles
  const tiles = document.querySelectorAll(".tile");
  if (tiles.length) {
    fetch(
      `/api/analytics/${window.siteId}?changelogIds=${encodeURIComponent(
        JSON.stringify(window.changelogIds)
      )}`
    )
      .then((resp) => resp.json())
      .then(({ data }) => {
        tiles.forEach((tile) => {
          const id = tile.getAttribute("data-changelog-id");
          const entry = data[id];
          if (entry) {
            const pageviewEl = tile.querySelector(".pageviews > .count");
            const clapsEl = tile.querySelector(".claps > .count");
            pageviewEl.innerHTML = compactInteger(entry.pageviews);
            clapsEl.innerHTML = compactInteger(entry.claps);
          }
        });
      });
  }

  // wire up the preview banner
  if (location.pathname.indexOf("/_preview/") === 0) {
    const body = document.querySelector("body");
    const div = document.createElement("div");
    div.className = "preview_banner";
    const wrapper = document.createElement("div");
    div.appendChild(wrapper);
    const inner = document.createElement("div");
    wrapper.append(inner);
    const span1 = document.createElement("span");
    const p = document.createElement("p");
    p.innerHTML = "You are viewing an unpublished preview";
    inner.appendChild(span1);
    inner.appendChild(p);
    span1.innerHTML = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="info-circle" class="svg-inline--fa fa-info-circle fa-w-16 text-yellow-900" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.043 8 8 119.083 8 256c0 136.997 111.043 248 248 248s248-111.003 248-248C504 119.083 392.957 8 256 8zm0 110c23.196 0 42 18.804 42 42s-18.804 42-42 42-42-18.804-42-42 18.804-42 42-42zm56 254c0 6.627-5.373 12-12 12h-88c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h12v-64h-12c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h64c6.627 0 12 5.373 12 12v100h12c6.627 0 12 5.373 12 12v24z"></path></svg>`;
    body.prepend(div);
  }

  // wire up theme switch
  const mode = document.querySelector("button.mode");
  if (mode) {
    mode.addEventListener("click", function () {
      const html = document.documentElement;
      const dark = html.classList.contains("dark");
      if (dark) {
        html.classList.remove("dark");
        localStorage.theme = "light";
      } else {
        html.classList.add("dark");
        localStorage.theme = "dark";
      }
    });
  }

  // wire up toggles
  const toggles = document.querySelectorAll(".toggle");
  if (toggles && toggles.length) {
    toggles.forEach((toggle) => {
      const content = toggle.querySelector(":scope > .content");
      const options = toggle.querySelector(":scope > .options");
      const icon = options.querySelector(":scope > .icon > svg");
      const title = options.querySelector(":scope > .title");
      const expand = function () {
        options.removeEventListener("click", expand);
        options.addEventListener("click", collapse);
        icon.style.transform = "rotate(0deg)";
        title.style.display = "none";
        content.style.display = "block";
      };
      const collapse = function () {
        options.removeEventListener("click", collapse);
        options.addEventListener("click", expand);
        icon.style.transform = "rotate(270deg)";
        title.style.display = "block";
        content.style.display = "none";
      };
      options.addEventListener("click", collapse);
    });
  }

  // wire up youtube players
  const wireUpYouTubePlayer = (
    ytPlayer,
    playButtonSelector,
    overlaySelector,
    usePlayerUrl
  ) => {
    const playButton = ytPlayer.querySelector(playButtonSelector);
    const overlay = overlaySelector
      ? ytPlayer.querySelector(overlaySelector)
      : undefined;
    const play = function () {
      ytPlayer.removeEventListener("click", play);
      const iframe = document.createElement("iframe");
      iframe.className = "embed-reponsive-item";
      iframe.width = "560";
      iframe.height = "315";
      iframe.allow =
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
      iframe.src = usePlayerUrl
        ? ytPlayer.getAttribute("data-url")
        : playButton.getAttribute("data-url");
      iframe.allowFullscreen = true;
      ytPlayer.appendChild(iframe);
      playButton.style.display = "none";
      if (overlay) {
        overlay.style.display = "none";
      }
    };
    const warm = function () {
      ytPlayer.removeEventListener("pointerover", warm);
      const link1 = document.createElement("link");
      link1.rel = "preconnect";
      link1.href = "https://www.youtube-nocookie.com";
      const link2 = document.createElement("link");
      link2.rel = "preconnect";
      link2.href = "https://www.google.com";
      document.body.appendChild(link1);
      document.body.appendChild(link2);
    };
    ytPlayer.addEventListener("pointerover", warm);
    ytPlayer.addEventListener("click", play);
  };

  let ytPlayers = document.querySelectorAll(".youtube.ryt-lite");
  if (ytPlayers && ytPlayers.length) {
    ytPlayers.forEach((ytPlayer) =>
      wireUpYouTubePlayer(ytPlayer, ":scope .lty-playbtn")
    );
  }

  ytPlayers = document.querySelectorAll(".yt");
  if (ytPlayers && ytPlayers.length) {
    ytPlayers.forEach((ytPlayer) =>
      wireUpYouTubePlayer(
        ytPlayer,
        ":scope > .yt-play-button",
        ":scope > .overlay",
        true
      )
    );
  }

  // handle high-five clap interaction
  const highfives = document.querySelectorAll(".highfive");
  if (highfives && highfives.length) {
    let currentCount = 0;
    let timer = 0;
    let ismaxed = false;
    highfives.forEach(function (highfive) {
      const counter = highfive.querySelector(".counter");
      const image = highfive.querySelector(".image");
      const counterAnimation = highfive.querySelector(".counter-animation");
      highfive.addEventListener("click", function () {
        if (ismaxed) {
          return; // stop after ismaxed
        }
        clearTimeout(timer);
        currentCount++;
        counter.innerHTML = compactInteger(currentCount);
        image.classList.add("animating");
        counter.classList.add("animating");
        counterAnimation.classList.add("animating");
        counterAnimation.innerHTML = `+${deviceCount}`;
        fetch(`/api/clap`, {
          method: "POST",
          body: JSON.stringify({
            siteId: window.siteId,
            changelogId: window.changelogId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        })
          .then((resp) => resp.json())
          .then(({ counts }) => {
            highfives.forEach(function (highfive) {
              const counter = highfive.querySelector(".counter");
              const counterAnimation =
                highfive.querySelector(".counter-animation");
              counter.innerHTML = compactInteger(counts.count);
              counterAnimation.innerHTML = `+${counts.sessionCount}`;
            });
            deviceCount = counts.sessionCount;
            currentCount = counts.count;
            ismaxed = counts.max;
          })
          .finally(() => {
            timer = setTimeout(() => {
              image.classList.remove("animating");
              counter.classList.remove("animating");
              counterAnimation.classList.remove("animating");
            }, 250);
          });
      });
    });
    const getHighfiveCount = function () {
      const url = `/api/clap/count/${changelogId}?unique=true`;
      fetch(url)
        .then((resp) => resp.json())
        .then((val) => {
          const { count, deviceCount: dc } = val;
          const ci = compactInteger(count);
          highfives.forEach(function (highfive) {
            const counter = highfive.querySelector(".counter");
            counter.innerHTML = ci;
          });
          deviceCount = dc;
          currentCount = count;
        });
    };
    getHighfiveCount();
  }

  // Wire up filters
  function getSearchClient() {
    if (typeof algoliasearch !== "undefined") {
      const client = algoliasearch(
        "1XS2RO6RZM",
        "b80a77afd30ab3b1d33b5b4ed3863acd"
      );
      const index = client.initIndex("changelog");
      return index;
    }
  }
  if (window.location.pathname.indexOf("/search") === 0) {
    const index = getSearchClient();
    if (!index) {
      console.error("No Search Index");
      return;
    }
    const filters = getFilters();
    const term = getSearchTerm();

    const input = document.querySelector("#search-input");
    const container = document.querySelector(
      "[data-changelog-id=__PLACEHOLDER_ID__]"
    );
    const grid = document.querySelector(".tiles");
    const filterList = document.querySelector("#filter-taglist");

    function renderRemoveSearchTermButton(value) {
      const element = createTag(
        value,
        "var(--tag-feature-bgcolor,#D1D5DB)",
        "var(--tag-fgcolor, #6B7280)",
        "1px solid var(--tag-bcolor, #9CA3AF)",
        true
      );
      element.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        exitFiltering();
        return false;
      };
      filterList.appendChild(element);
    }

    if (input && term) {
      input.value = term;
      renderRemoveSearchTermButton(term);
    }

    function removeFilterFromQuery(currentFilter) {
      const idx = filters.findIndex((f) => f.t === currentFilter.t);
      if (idx >= 0) {
        if (filters.length === 1) {
          exitFiltering();
        } else {
          filters.splice(idx, 1);
          navigateToFilters(filters);
        }
      }
    }

    function addFilterToQuery(currentFilter) {
      const idx = filters.findIndex((f) => f.t === currentFilter.t);
      if (idx < 0) {
        filters.push(currentFilter);
        navigateToFilters(filters);
      }
    }

    function renderRemoveFilterButton(filter) {
      const element = createTag(filter.t, filter.bg, filter.c, filter.b, true);
      element.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFilterFromQuery(filter);
        return false;
      };
      filterList.appendChild(element);
    }

    function renderTileTag(tagColor, target) {
      const element = createTag(
        tagColor.tag,
        tagColor.backgroundColor,
        tagColor.color,
        tagColor.border
      );
      element.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        addFilterToQuery({
          t: tagColor.tag,
          bg: tagColor.backgroundColor,
          c: tagColor.color,
          b: tagColor.border,
        });
        return false;
      };
      target.appendChild(element);
    }

    function getTileElement(changelog, template) {
      const copy = template.cloneNode(true);
      copy.querySelector(".title").innerHTML = changelog.title;
      copy.querySelector(".headline").innerHTML = changelog.headline;
      copy.querySelector(".pageviews").remove();
      copy.querySelector(".claps").remove();
      copy.querySelector(".date").innerHTML = Intl.DateTimeFormat().format(
        new Date(changelog.createdAt || 0)
      );
      const { pathname } = new URL(changelog.url || "#");
      copy.href = pathname;
      copy.setAttribute("data-changelog-id", changelog.objectID);
      if (changelog.coverMedia && changelog.coverMedia.type === "image") {
        const src = changelog.coverMedia.value;
        copy.querySelector("img").src = src;
      } else {
        copy.querySelector("img").remove();
        const placeHolder = document.createElement("div");
        placeHolder.classList.add("empty");
        placeHolder.innerHTML = "&nbsp;";
        copy.prepend(placeHolder);
      }
      if (changelog.tagColors) {
        const tagTarget = copy.querySelector(".taglist");
        changelog.tagColors.forEach((tagColor) =>
          renderTileTag(tagColor, tagTarget)
        );
      }

      return copy;
    }

    if (container && grid && filterList) {
      const template = container.cloneNode(true);
      grid.innerHTML = "";
      filters.forEach(renderRemoveFilterButton);
      function handleHits(res) {
        if (res) {
          document.querySelector(".loader").remove();
          if (res.hits && res.hits.length) {
            res.hits.forEach((hit) =>
              grid.appendChild(getTileElement(hit, template))
            );
            document.querySelector("#no-search-results").remove();
          }
        }
      }

      if ((filters.length || term) && index) {
        const query = `site_id:"${window.siteId}" ${
          (filters &&
            filters.length > 0 &&
            ` AND ${filters.map((f) => `tags:"${f.t}"`).join(" AND ")}`) ||
          ""
        }`;
        index.search(term, { filters: query }).then(handleHits);
      }
    }
  } else {
    hydrateIndexTags();
  }

  // Wire up search
  const form = document.querySelector(".search-form");
  if (form) {
    const input = document.querySelector(".search-input");
    if (input) {
      form.onsubmit = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (input.value) {
          navigateToSearchTerm(input.value);
        } else {
          exitFiltering();
        }
        return false;
      };
    }
  }
})();

// remove preload class from body on load
window.onload = function () {
  document.querySelector("body").classList.remove("preload");
  // check to see if we are a subscriber and if not, show the subscribe links
  const subid = document.cookie
    .split("; ")
    .find((c) => c.includes("subscription_id="));
  if (!subid) {
    document
      .querySelectorAll("a.subscribe[data-subscribe=true]")
      .forEach((item) => item.classList.remove("invisible"));
  }
};
