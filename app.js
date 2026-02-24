const STORAGE_KEY = "simple-todo-items";

const projectForm = document.querySelector("#project-form");
const projectInput = document.querySelector("#project-input");
const projectSelect = document.querySelector("#project-select");
const renameProjectBtn = document.querySelector("#rename-project-btn");
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
let selectedProjectId = store.selectedProjectId || store.projects[0].id;

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

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function makeDefaultProject() {
  return {
    id: makeId("project"),
    name: "기본 프로젝트",
    todosByDate: {},
  };
}

function normalizeItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : makeId("todo"),
      text: item.text.trim(),
      completed: Boolean(item.completed),
      completedAt: item.completed ? item.completedAt || null : null,
    }))
    .filter((item) => item.text.length > 0);
}

function normalizeTodosByDate(inputMap) {
  if (!inputMap || typeof inputMap !== "object" || Array.isArray(inputMap)) return {};
  const normalizedMap = {};

  Object.keys(inputMap).forEach((dateKey) => {
    normalizedMap[dateKey] = normalizeItems(inputMap[dateKey]);
  });

  return normalizedMap;
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];

  return projects
    .filter((project) => project && typeof project === "object")
    .map((project) => ({
      id: typeof project.id === "string" ? project.id : makeId("project"),
      name:
        typeof project.name === "string" && project.name.trim()
          ? project.name.trim()
          : "이름 없는 프로젝트",
      todosByDate: normalizeTodosByDate(project.todosByDate),
    }));
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultProject = makeDefaultProject();
      return {
        projects: [defaultProject],
        selectedProjectId: defaultProject.id,
      };
    }

    const parsed = JSON.parse(raw);

    // Legacy format migration: array -> default project with today's items
    if (Array.isArray(parsed)) {
      const defaultProject = makeDefaultProject();
      defaultProject.todosByDate[getTodayKey()] = normalizeItems(parsed);
      return {
        projects: [defaultProject],
        selectedProjectId: defaultProject.id,
      };
    }

    if (!parsed || typeof parsed !== "object") {
      const defaultProject = makeDefaultProject();
      return {
        projects: [defaultProject],
        selectedProjectId: defaultProject.id,
      };
    }

    // Previous version migration: { todosByDate: {...} } -> one default project
    if (parsed.todosByDate && !parsed.projects) {
      const defaultProject = makeDefaultProject();
      defaultProject.todosByDate = normalizeTodosByDate(parsed.todosByDate);
      return {
        projects: [defaultProject],
        selectedProjectId: defaultProject.id,
      };
    }

    const normalizedProjects = normalizeProjects(parsed.projects);
    const projects = normalizedProjects.length > 0 ? normalizedProjects : [makeDefaultProject()];
    const hasSelected = projects.some((project) => project.id === parsed.selectedProjectId);

    return {
      projects,
      selectedProjectId: hasSelected ? parsed.selectedProjectId : projects[0].id,
    };
  } catch {
    const defaultProject = makeDefaultProject();
    return {
      projects: [defaultProject],
      selectedProjectId: defaultProject.id,
    };
  }
}

function saveStore() {
  store.selectedProjectId = selectedProjectId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function makeTodo(text) {
  return {
    id: makeId("todo"),
    text,
    completed: false,
    completedAt: null,
  };
}

function getSelectedProject() {
  const project = store.projects.find((item) => item.id === selectedProjectId);
  if (project) return project;

  selectedProjectId = store.projects[0].id;
  return store.projects[0];
}

function getTodosForDate(dateKey) {
  const project = getSelectedProject();
  return project.todosByDate[dateKey] || [];
}

function setTodosForDate(dateKey, items) {
  const project = getSelectedProject();
  project.todosByDate[dateKey] = items;
}

function getVisibleTodos(items) {
  if (currentFilter === "active") return items.filter((todo) => !todo.completed);
  if (currentFilter === "completed") return items.filter((todo) => todo.completed);
  return items;
}

function updateCount(items) {
  const remaining = items.filter((todo) => !todo.completed).length;
  const projectName = getSelectedProject().name;
  countText.textContent = `[${projectName}] ${selectedDate} 남은 할 일 ${remaining}개`;
}

function getRecentDays(baseDateKey, days) {
  return Array.from({ length: days }, (_, index) => addDays(baseDateKey, -index));
}

function getDayOffsetLabel(offset) {
  if (offset === 1) return "어제";
  return `${offset}일 전`;
}

function renderProjects() {
  projectSelect.innerHTML = "";

  store.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    if (project.id === selectedProjectId) option.selected = true;
    projectSelect.append(option);
  });
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
  renderProjects();

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

    const actionWrap = document.createElement("div");
    actionWrap.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => renameTodo(todo.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    actionWrap.append(editBtn, deleteBtn);
    item.append(checkbox, label, actionWrap);
    todoList.append(item);
  });

  updateCount(dateTodos);
  renderWeeklyStats();
  renderRecentCompleted(3);
}

function createProject(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const duplicated = store.projects.some(
    (project) => project.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicated) {
    alert("이미 같은 이름의 프로젝트가 있습니다.");
    return;
  }

  const newProject = {
    id: makeId("project"),
    name: trimmed,
    todosByDate: {},
  };

  store.projects.push(newProject);
  selectedProjectId = newProject.id;
  saveStore();
  renderTodos();
}

function renameProject() {
  const project = getSelectedProject();
  const nextName = prompt("새 프로젝트 이름을 입력하세요.", project.name);
  if (nextName === null) return;

  const trimmed = nextName.trim();
  if (!trimmed) {
    alert("프로젝트 이름을 입력해주세요.");
    return;
  }

  const duplicated = store.projects.some(
    (item) => item.id !== project.id && item.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicated) {
    alert("이미 같은 이름의 프로젝트가 있습니다.");
    return;
  }

  project.name = trimmed;
  saveStore();
  renderTodos();
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

function renameTodo(id) {
  const items = getTodosForDate(selectedDate);
  const target = items.find((todo) => todo.id === id);
  if (!target) return;

  const nextText = prompt("할 일 이름을 수정하세요.", target.text);
  if (nextText === null) return;

  const trimmed = nextText.trim();
  if (!trimmed) {
    alert("할 일 이름을 입력해주세요.");
    return;
  }

  const updated = items.map((todo) => (todo.id === id ? { ...todo, text: trimmed } : todo));
  setTodosForDate(selectedDate, updated);
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

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createProject(projectInput.value);
  projectInput.value = "";
  projectInput.focus();
});

projectSelect.addEventListener("change", () => {
  selectedProjectId = projectSelect.value;
  saveStore();
  renderTodos();
});

renameProjectBtn.addEventListener("click", renameProject);

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
saveStore();
renderTodos();
