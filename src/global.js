/* global stuff here */

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

(function () {
  // wire up tiles
  const tiles = document.querySelectorAll(".tile");
  if (tiles.length) {
    fetch(
      `https://${window.apiURL}/site/${
        window.siteId
      }/analytics?changelogIds=${encodeURIComponent(
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

  // wire up theme switch
  const mode = document.querySelector("button.mode");
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
  // handle youtube player
  const buttons = document.querySelectorAll(".youtube .lty-playbtn");
  if (buttons) {
    buttons.forEach((button) => {
      const parent = button.parentElement;
      const listener = function () {
        button.removeEventListener("click", listener);
        const iframe = document.createElement("iframe");
        iframe.className = "embed-reponsive-item";
        iframe.width = "560";
        iframe.height = "315";
        iframe.frameBorder = "0";
        iframe.allow =
          "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
        iframe.src = button.getAttribute("data-url");
        iframe.allowFullscreen = true;
        parent.appendChild(iframe);
        parent.classList.add("lty-playbt");
        button.style.display = "none";
      };
      const warm = function () {
        parent.removeEventListener("pointerover", warm);
        const link1 = document.createElement("link");
        link1.rel = "preconnect";
        link1.href = "https://www.youtube-nocookie.com";
        const link2 = document.createElement("link");
        link2.rel = "preconnect";
        link2.href = "https://www.google.com";
        document.body.appendChild(link1);
        document.body.appendChild(link2);
      };
      button.addEventListener("click", listener);
      parent.addEventListener("pointerover", warm);
    });
  }
  // handle high-five clap interaction
  const highfive = document.querySelector(".highfive");
  if (highfive) {
    let currentCount = 0;
    let timer = 0;
    let ismaxed = false;
    const counter = document.querySelector(".highfive .counter");
    const container = document.querySelector(".highfive .container");
    const counterAnimation = document.querySelector(
      ".highfive .counter-animation"
    );
    const getHighfiveCount = function () {
      const url = `https://${window.apiURL}/changelog/clap/count/${changelogId}?unique=true`;
      fetch(url)
        .then((resp) => resp.json())
        .then((val) => {
          const { count, deviceCount: dc } = val;
          counter.innerHTML = compactInteger(count);
          deviceCount = dc;
          currentCount = count;
        });
    };
    getHighfiveCount();
    highfive.addEventListener("click", function () {
      if (ismaxed) {
        return; // stop after ismaxed
      }
      clearTimeout(timer);
      currentCount++;
      counter.innerHTML = compactInteger(currentCount);
      container.classList.add("animating");
      counter.classList.add("animating");
      counterAnimation.classList.add("animating");
      counterAnimation.innerHTML = `+${deviceCount}`;
      fetch(`https://${window.apiURL}/changelog/clap`, {
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
          counter.innerHTML = compactInteger(counts.count);
          counterAnimation.innerHTML = `+${counts.sessionCount}`;
          deviceCount = counts.sessionCount;
          currentCount = counts.count;
          ismaxed = counts.max;
        })
        .finally(() => {
          timer = setTimeout(() => {
            container.classList.remove("animating");
            counter.classList.remove("animating");
            counterAnimation.classList.remove("animating");
          }, 250);
        });
    });
  }
})();
