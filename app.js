const STORAGE_KEY = "simple-todo-items";

const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const todoDate = document.querySelector("#todo-date");
const todoList = document.querySelector("#todo-list");
const countText = document.querySelector("#todo-count");
const clearCompletedBtn = document.querySelector("#clear-completed");
const filterButtons = document.querySelectorAll(".filter-btn");
const weekSummary = document.querySelector("#week-summary");
const weekChart = document.querySelector("#week-chart");
const recentCompletedList = document.querySelector("#recent-completed-list");
const recentCompletedEmpty = document.querySelector("#recent-completed-empty");

let store = loadStore();
let selectedDate = getTodayKey();
let currentFilter = "all";

function toDateKey(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return toDateKey(new Date());
}

function addDays(dateKey, days) {
  const dateObj = new Date(`${dateKey}T00:00:00`);
  dateObj.setDate(dateObj.getDate() + days);
  return toDateKey(dateObj);
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : makeId(),
      text: item.text.trim(),
      completed: Boolean(item.completed),
      completedAt: item.completed ? item.completedAt || null : null,
    }))
    .filter((item) => item.text.length > 0);
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { todosByDate: {} };
    const parsed = JSON.parse(raw);

    // Legacy format migration: array -> today list
    if (Array.isArray(parsed)) {
      return {
        todosByDate: {
          [getTodayKey()]: normalizeItems(parsed),
        },
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return { todosByDate: {} };
    }

    const inputMap = parsed.todosByDate;
    if (!inputMap || typeof inputMap !== "object" || Array.isArray(inputMap)) {
      return { todosByDate: {} };
    }

    const normalizedMap = {};
    Object.keys(inputMap).forEach((dateKey) => {
      normalizedMap[dateKey] = normalizeItems(inputMap[dateKey]);
    });

    return { todosByDate: normalizedMap };
  } catch {
    return { todosByDate: {} };
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function makeTodo(text) {
  return {
    id: makeId(),
    text,
    completed: false,
    completedAt: null,
  };
}

function getTodosForDate(dateKey) {
  return store.todosByDate[dateKey] || [];
}

function setTodosForDate(dateKey, items) {
  store.todosByDate[dateKey] = items;
}

function getVisibleTodos(items) {
  if (currentFilter === "active") {
    return items.filter((todo) => !todo.completed);
  }

  if (currentFilter === "completed") {
    return items.filter((todo) => todo.completed);
  }

  return items;
}

function updateCount(items) {
  const remaining = items.filter((todo) => !todo.completed).length;
  countText.textContent = `${selectedDate} 남은 할 일 ${remaining}개`;
}

function getRecentDays(baseDateKey, days) {
  return Array.from({ length: days }, (_, index) => addDays(baseDateKey, -index));
}

function getDayOffsetLabel(offset) {
  if (offset === 1) return "어제";
  return `${offset}일 전`;
}

function renderRecentCompleted(days = 3) {
  recentCompletedList.innerHTML = "";
  let count = 0;

  for (let offset = 1; offset <= days; offset += 1) {
    const dateKey = addDays(selectedDate, -offset);
    const completed = getTodosForDate(dateKey).filter((todo) => todo.completed);

    completed.forEach((todo) => {
      const item = document.createElement("li");
      item.className = "todo-item completed history-item";

      const marker = document.createElement("span");
      marker.className = "history-marker";
      marker.textContent = getDayOffsetLabel(offset);

      const label = document.createElement("label");
      label.textContent = todo.text;

      item.append(marker, label);
      recentCompletedList.append(item);
      count += 1;
    });
  }

  recentCompletedEmpty.hidden = count > 0;
}

function renderWeeklyStats() {
  const recentDays = getRecentDays(selectedDate, 7).reverse();
  let totalTasks = 0;
  let totalCompleted = 0;

  weekChart.innerHTML = "";

  recentDays.forEach((dateKey) => {
    const items = getTodosForDate(dateKey);
    const done = items.filter((todo) => todo.completed).length;
    const total = items.length;
    const ratio = total === 0 ? 0 : Math.round((done / total) * 100);

    totalTasks += total;
    totalCompleted += done;

    const item = document.createElement("li");
    item.className = "week-bar-item";

    const label = document.createElement("span");
    label.className = "week-label";
    label.textContent = dateKey.slice(5);

    const barWrap = document.createElement("div");
    barWrap.className = "week-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "week-bar-fill";
    bar.style.width = `${ratio}%`;

    const value = document.createElement("span");
    value.className = "week-value";
    value.textContent = `${done}/${total}`;

    barWrap.append(bar);
    item.append(label, barWrap, value);
    weekChart.append(item);
  });

  const weeklyRate = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);
  weekSummary.textContent = `최근 7일 완료율 ${weeklyRate}% (${totalCompleted}/${totalTasks})`;
}

function renderTodos() {
  const dateTodos = getTodosForDate(selectedDate);
  const visibleTodos = getVisibleTodos(dateTodos);

  todoList.innerHTML = "";

  visibleTodos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "todo-item";
    if (todo.completed) item.classList.add("completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `${todo.text} 완료 상태 전환`);
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const label = document.createElement("label");
    label.textContent = todo.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    item.append(checkbox, label, deleteBtn);
    todoList.append(item);
  });

  updateCount(dateTodos);
  renderWeeklyStats();
  renderRecentCompleted(3);
}

function addTodo(text) {
  const items = getTodosForDate(selectedDate);
  setTodosForDate(selectedDate, [makeTodo(text), ...items]);
  saveStore();
  renderTodos();
}

function toggleTodo(id) {
  const items = getTodosForDate(selectedDate).map((todo) => {
    if (todo.id !== id) return todo;
    const completed = !todo.completed;
    return {
      ...todo,
      completed,
      completedAt: completed ? Date.now() : null,
    };
  });

  setTodosForDate(selectedDate, items);
  saveStore();
  renderTodos();
}

function deleteTodo(id) {
  const items = getTodosForDate(selectedDate).filter((todo) => todo.id !== id);
  setTodosForDate(selectedDate, items);
  saveStore();
  renderTodos();
}

function clearCompleted() {
  const items = getTodosForDate(selectedDate).filter((todo) => !todo.completed);
  setTodosForDate(selectedDate, items);
  saveStore();
  renderTodos();
}

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  addTodo(text);
  todoInput.value = "";
  todoInput.focus();
});

todoDate.addEventListener("change", () => {
  selectedDate = todoDate.value || getTodayKey();
  renderTodos();
});

clearCompletedBtn.addEventListener("click", clearCompleted);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    renderTodos();
  });
});

todoDate.value = selectedDate;
renderTodos();
