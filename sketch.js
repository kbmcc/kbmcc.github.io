let electionData;
let partyHistoryData;
let chart;
let countySelect;
let shiftFilter;
let dataStatus;
let detailCopy;
let partyYearInput;
let partyYearOutput;
let partyTimeline;
let partyTimelineStatus;
let currentFilter = "all";
let selectedCounty = "";
let hoveredCounty = "";
let loadError = false;
let partyHistoryLoadError = false;

const COLORS = {
  background: "#17272c",
  text: "#eaece6",
  muted: "#9daead",
  republican: "#e8785f",
  democratic: "#63b2c7"
};

const MIN_MARGIN = -40;
const MAX_MARGIN = 100;
const numberFormat = new Intl.NumberFormat("en-US");

function preload() {
  loadJSON(
    "data/texas-governor.json",
    function (data) {
      electionData = data;
    },
    function (error) {
      loadError = true;
      console.error("Could not load the Texas election data.", error);
    }
  );
  loadJSON(
    "data/texas-party-history.json",
    function (data) {
      partyHistoryData = data;
    },
    function (error) {
      partyHistoryLoadError = true;
      console.error("Could not load the Texas party history data.", error);
    }
  );
}

function setup() {
  partyYearInput = document.getElementById("party-year");
  partyYearOutput = document.getElementById("party-year-output");
  partyTimeline = document.getElementById("party-timeline");
  partyTimelineStatus = document.getElementById("party-timeline-status");
  chart = document.getElementById("chart-canvas");
  countySelect = document.getElementById("county-select");
  shiftFilter = document.getElementById("shift-filter");
  dataStatus = document.getElementById("data-status");
  detailCopy = document.getElementById("detail-copy");
  noCanvas();
  noLoop();

  if (partyHistoryLoadError || !partyHistoryData) {
    showPartyTimelineError();
  } else {
    partyYearInput.addEventListener("input", function () {
      updatePartyYear(Number(partyYearInput.value));
    });
    partyTimeline.addEventListener("click", function (event) {
      const yearMark = event.target.closest(".party-year-mark");
      if (yearMark) {
        updatePartyYear(Number(yearMark.dataset.year));
      }
    });
    renderPartyTimeline();
    updatePartyYear(2026);
  }

  if (loadError || !electionData) {
    showDataError();
    return;
  }

  countySelect.addEventListener("change", function () {
    selectedCounty = countySelect.value;
    if (selectedCounty && !visibleCounties().some(function (county) {
      return county.county === selectedCounty;
    })) {
      currentFilter = "all";
      shiftFilter.value = "all";
    }
    hoveredCounty = "";
    renderChart();
    updateCountyDetail(selectedCounty ? findCounty(selectedCounty) : null);
  });

  shiftFilter.addEventListener("change", function () {
    currentFilter = shiftFilter.value;
    if (selectedCounty && !visibleCounties().some(function (county) {
      return county.county === selectedCounty;
    })) {
      selectedCounty = "";
      countySelect.value = "";
    }
    hoveredCounty = "";
    renderChart();
    updateCountyDetail(null);
  });

  populateCountyMenu();
  updateSummary();
  renderChart();
  dataStatus.hidden = true;
}

const PARTY_OFFICES = [
  { key: "governor", title: "Governor", maxSeats: 1 },
  { key: "usSenate", title: "U.S. Senate", maxSeats: 2 },
  { key: "usHouse", title: "U.S. House delegation", maxSeats: 38 },
  { key: "texasHouse", title: "Texas House", maxSeats: 150 }
];

function renderPartyTimeline() {
  const years = partyHistoryData.years;
  const ticks = years.map(function (year) {
    const label = year === years[0] || year === years[years.length - 1] ||
      year % 10 === 0;
    return '<span class="party-year-tick">' +
      (label ? year : "") + "</span>";
  });
  const rows = PARTY_OFFICES.map(function (office) {
    const marks = years.map(function (year, index) {
      const values = partyHistoryData[office.key][index];
      const dem = values[0];
      const rep = values[1];
      const other = values[2];
      const projected = year === 2026;
      const label = year + (projected ? " projected election result" : "") +
        ": " + office.title + ", " + dem + " Democrats, " + rep +
        " Republicans, " + other + " other.";

      return '<button class="party-year-mark' +
        (projected ? " is-projected" : "") +
        '" type="button" data-year="' + year +
        '" aria-pressed="false" aria-label="' + label +
        '" title="' + label + '"><span class="party-bar" aria-hidden="true">' +
        '<span class="party-segment dem" style="height:' +
        (dem / office.maxSeats * 100) + '%"></span>' +
        '<span class="party-segment rep" style="height:' +
        (rep / office.maxSeats * 100) + '%"></span>' +
        '<span class="party-segment other" style="height:' +
        (other / office.maxSeats * 100) + '%"></span>' +
        "</span></button>";
    });

    return '<div class="party-office-row" data-office="' + office.key +
      '"><div class="party-office-label"><span>' + office.title +
      '</span><small>scale: 0–' + office.maxSeats +
      ' seats</small></div><div class="party-columns">' +
      marks.join("") + "</div></div>";
  });

  partyTimeline.innerHTML =
    '<div class="party-year-ticks" aria-hidden="true"><span class="party-row-label">YEAR</span>' +
    '<div class="party-columns">' + ticks.join("") + "</div></div>" +
    rows.join("") +
    '<div class="party-timeline-legend">' +
    '<span><i class="party-legend-swatch dem"></i> Democratic</span>' +
    '<span><i class="party-legend-swatch rep"></i> Republican</span>' +
    '<span><i class="party-legend-swatch other"></i> Other party</span>' +
    "</div>";
}

function updatePartyYear(year) {
  if (!partyHistoryData || !partyYearInput) {
    return;
  }

  const index = partyHistoryData.years.indexOf(year);
  if (index < 0) {
    return;
  }

  const isProjected = year === 2026;
  partyYearInput.value = String(year);
  partyYearOutput.textContent = year + (isProjected ? " · projected" : "");

  partyTimeline.querySelectorAll(".party-year-mark").forEach(function (mark) {
    const isSelected = Number(mark.dataset.year) === year;
    mark.classList.toggle("is-selected", isSelected);
    mark.setAttribute("aria-pressed", String(isSelected));
  });

  const selectedMark = partyTimeline.querySelector(".party-year-mark.is-selected");
  const timelineWrap = partyTimeline.parentElement;
  const markBounds = selectedMark.getBoundingClientRect();
  const wrapBounds = timelineWrap.getBoundingClientRect();
  if (markBounds.left < wrapBounds.left) {
    timelineWrap.scrollLeft += markBounds.left - wrapBounds.left;
  } else if (markBounds.right > wrapBounds.right) {
    timelineWrap.scrollLeft += markBounds.right - wrapBounds.right;
  }

  PARTY_OFFICES.forEach(function (office) {
    const values = partyHistoryData[office.key][index];
    const dem = values[0];
    const rep = values[1];
    const other = values[2];
    const card = document.querySelector(
      '.party-count-card[data-office="' + office.key + '"]'
    );
    const houseMembers = office.key === "texasHouse" ? values[3] : dem + rep + other;

    card.classList.toggle("is-projected", isProjected);
    card.querySelector(".count-dem").textContent = dem;
    card.querySelector(".count-rep").textContent = rep;
    if (office.key === "texasHouse") {
      card.querySelector(".count-other").textContent =
        (other ? other + " other · " : "") +
        (isProjected ? "2026 election returns · " :
          "session opening " +
          partyHistoryData.texasHouseSourceYears[index] + " · ") +
        houseMembers + " of 150 seats";
    } else if (office.key === "usHouse") {
      card.querySelector(".count-other").textContent =
        other ? other + " other · " + houseMembers + " seats counted" :
          houseMembers + " seats counted";
    } else if (other) {
      card.querySelector(".count-other").textContent =
        other + " other · " + houseMembers + " seats";
    } else {
      card.querySelector(".count-other").textContent =
        houseMembers + (office.key === "governor" ? " office" : " seats");
    }
  });
}

function showPartyTimelineError() {
  partyTimelineStatus.hidden = false;
  partyTimelineStatus.textContent =
    "The party history could not be loaded. Please reload the page or check that data/texas-party-history.json is available.";
  partyTimeline.hidden = true;
}

function chartHeight(width) {
  return Math.max(390, Math.min(560, Math.round(width * 0.49)));
}

function chartGeometry(width, height) {
  return {
    left: Math.max(62, width * 0.105),
    right: width - 34,
    top: 72,
    bottom: height - 58
  };
}

function marginFor(county, year) {
  const result = county[String(year)];
  const total = result.dem + result.rep;
  return total ? ((result.rep - result.dem) / total) * 100 : 0;
}

function swingFor(county) {
  return marginFor(county, 2022) - marginFor(county, 2018);
}

function yForMargin(value, geometry) {
  const bounded = Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, value));
  const proportion = (bounded - MIN_MARGIN) / (MAX_MARGIN - MIN_MARGIN);
  return geometry.bottom - proportion * (geometry.bottom - geometry.top);
}

function visibleCounties() {
  if (!electionData) {
    return [];
  }

  return electionData.counties.filter(function (county) {
    const swing = swingFor(county);
    return currentFilter === "all" ||
      (currentFilter === "republican" && swing > 0) ||
      (currentFilter === "democratic" && swing < 0);
  });
}

function findCounty(name) {
  return electionData.counties.find(function (county) {
    return county.county === name;
  });
}

function renderChart() {
  if (!electionData || !chart) {
    return;
  }

  const width = Math.max(280, Math.round(chart.clientWidth));
  const height = chartHeight(width);
  const geometry = chartGeometry(width, height);
  const xStart = geometry.left + 26;
  const xEnd = geometry.right - 8;
  const rows = visibleCounties();
  const markup = [
    '<div class="county-plot" style="height:' + height + 'px" role="group"',
    ' aria-label="Republican two-party margins in 2018 and 2022 for ' +
      rows.length + ' comparable Texas counties">',
    renderGrid(geometry, width, height)
  ];

  rows.forEach(function (county) {
    const y2018 = yForMargin(marginFor(county, 2018), geometry);
    const y2022 = yForMargin(marginFor(county, 2022), geometry);
    const swing = swingFor(county);
    const color = swing >= 0 ? COLORS.republican : COLORS.democratic;
    const isSelected = county.county === selectedCounty;
    const lineWidth = xEnd - xStart;
    const angle = Math.atan2(y2022 - y2018, lineWidth);
    const countyName = escapeHtml(county.county);

    markup.push(
      '<button class="county-slope' + (isSelected ? " is-selected" : "") +
        '" type="button" data-county="' + countyName +
      '" data-x1="' + xStart + '" data-y1="' + y2018 +
      '" data-x2="' + xEnd + '" data-y2="' + y2022 +
      '" aria-label="' + countyName + " County: 2018 " +
        signedMargin(marginFor(county, 2018)) + " percentage points; 2022 " +
        signedMargin(marginFor(county, 2022)) + " percentage points; swing " +
        signedMargin(swing) + ' points" title="' + countyName +
        ' County · 2018 ' + signedMargin(marginFor(county, 2018)) +
        ' pp · 2022 ' + signedMargin(marginFor(county, 2022)) +
        ' pp · swing ' + signedMargin(swing) +
        ' pp" style="--county-color:' + color + ";left:" + xStart +
        "px;top:" + y2018 + "px;width:" + lineWidth +
        "px;transform:rotate(" + angle + "rad)\"></button>",
      '<span class="county-endpoint" aria-hidden="true" style="--county-color:' +
        color + ";left:" + xStart + "px;top:" + y2018 + 'px"></span>',
      '<span class="county-endpoint" aria-hidden="true" style="--county-color:' +
        color + ";left:" + xEnd + "px;top:" + y2022 + 'px"></span>'
    );
  });

  markup.push("</div>");
  chart.innerHTML = markup.join("");
  attachChartEvents();
}

function renderGrid(geometry, width, height) {
  const ticks = [-40, -20, 0, 20, 40, 60, 80, 100];
  const parts = [
    '<div class="chart-axis-caption">REPUBLICAN TWO-PARTY MARGIN / PERCENTAGE POINTS</div>'
  ];

  ticks.forEach(function (tick) {
    const y = yForMargin(tick, geometry);
    const isZero = tick === 0;
    parts.push(
      '<span class="chart-gridline' + (isZero ? " is-zero" : "") +
        '" aria-hidden="true" style="left:' + geometry.left + "px;top:" +
        y + "px;width:" + (geometry.right - geometry.left) + 'px"></span>',
      '<span class="chart-tick' + (isZero ? " is-zero" : "") +
        '" style="left:' + (geometry.left - 10) + "px;top:" + y +
        'px">' + (tick > 0 ? "+" : "") + tick + "</span>"
    );
  });

  parts.push(
    '<span class="chart-lead-label" style="left:' + (geometry.left + 5) +
      "px;top:" + yForMargin(92, geometry) + 'px">R LEAD</span>',
    '<span class="chart-lead-label" style="left:' + (geometry.left + 5) +
      "px;top:" + yForMargin(-31, geometry) + 'px">D LEAD</span>',
    '<span class="chart-year" style="left:' + geometry.left + "px;top:" +
      (height - 24) + 'px">2018</span>',
    '<span class="chart-year is-right" style="left:' + geometry.right +
      "px;top:" + (height - 24) + 'px">2022</span>'
  );

  return parts.join("");
}

function attachChartEvents() {
  const plot = chart.querySelector(".county-plot");
  plot.addEventListener("pointermove", function (event) {
    const bounds = plot.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    let closestCounty = "";
    let closestDistance = 13;

    chart.querySelectorAll(".county-slope").forEach(function (line) {
      const x1 = Number(line.dataset.x1);
      const y1 = Number(line.dataset.y1);
      const dx = Number(line.dataset.x2) - x1;
      const dy = Number(line.dataset.y2) - y1;
      const progress = Math.max(
        0,
        Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))
      );
      const distance = Math.hypot(
        x - (x1 + progress * dx),
        y - (y1 + progress * dy)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCounty = line.dataset.county;
      }
    });

    setHoveredCounty(closestCounty);
  });
  plot.addEventListener("pointerleave", function () {
    setHoveredCounty("");
  });
  plot.addEventListener("focusin", function (event) {
    const line = event.target.closest(".county-slope");
    if (line) {
      setHoveredCounty(line.dataset.county);
    }
  });
  plot.addEventListener("focusout", function (event) {
    if (!plot.contains(event.relatedTarget)) {
      setHoveredCounty("");
    }
  });

  chart.querySelectorAll(".county-slope").forEach(function (line) {
    line.addEventListener("click", function () {
      selectedCounty = line.dataset.county;
      countySelect.value = selectedCounty;
      hoveredCounty = "";
      renderChart();
      updateCountyDetail(findCounty(selectedCounty));
    });
  });
}

function setHoveredCounty(countyName) {
  if (hoveredCounty === countyName) {
    return;
  }
  hoveredCounty = countyName;
  chart.querySelectorAll(".county-slope").forEach(function (line) {
    line.classList.toggle("is-hovered", line.dataset.county === hoveredCounty);
  });
  updateCountyDetail(
    findCounty(hoveredCounty || selectedCounty)
  );
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    }[character];
  });
}

function populateCountyMenu() {
  electionData.counties.forEach(function (county) {
    const option = document.createElement("option");
    option.value = county.county;
    option.textContent = county.county;
    countySelect.appendChild(option);
  });
}

function updateSummary() {
  const counties = electionData.counties;
  const republicanShifts = counties.filter(function (county) {
    return swingFor(county) > 0;
  }).length;
  const swings = counties.map(swingFor).sort(function (a, b) {
    return a - b;
  });
  const middle = Math.floor(swings.length / 2);
  const median = swings.length % 2 ?
    swings[middle] :
    (swings[middle - 1] + swings[middle]) / 2;

  document.getElementById("matched-count").textContent =
    counties.length + " / " + electionData.texasCountyCount;
  document.getElementById("republican-count").textContent =
    republicanShifts + " / " + counties.length;
  document.getElementById("median-swing").textContent = signedMargin(median) + " pp";
}

function updateCountyDetail(county) {
  if (!county) {
    detailCopy.textContent = "Hover a county line or use the county menu to explore the change.";
    return;
  }

  const swing = swingFor(county);
  const direction = swing > 0 ? "toward the Republican candidate" : "toward the Democratic candidate";
  detailCopy.textContent =
    county.county + " County: " +
    "2018 — R " + numberFormat.format(county["2018"].rep) +
    ", D " + numberFormat.format(county["2018"].dem) +
    " (" + signedMargin(marginFor(county, 2018)) + " pp); " +
    "2022 — R " + numberFormat.format(county["2022"].rep) +
    ", D " + numberFormat.format(county["2022"].dem) +
    " (" + signedMargin(marginFor(county, 2022)) + " pp). " +
    "Swing: " + signedMargin(swing) + " points " + direction + ".";
}

function signedMargin(value) {
  return (value > 0 ? "+" : "") + value.toFixed(1);
}

function showDataError() {
  dataStatus.hidden = false;
  dataStatus.textContent =
    "The election data could not be loaded. Please reload the page or check that data/texas-governor.json is available.";
}

function windowResized() {
  renderChart();
}
