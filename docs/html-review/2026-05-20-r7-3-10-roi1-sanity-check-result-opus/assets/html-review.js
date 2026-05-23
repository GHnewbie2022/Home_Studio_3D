(function () {
  "use strict";

  const root = document.querySelector("[data-review-root]");
  if (!root) return;

  const pageId =
    document.querySelector('meta[name="html-review-page-id"]')?.content ||
    location.pathname;
  const storageKey = "html_review_feedback_v1:" + pageId;
  const colors = ["yellow", "green", "blue", "rose"];
  let state = loadState();
  let pendingRange = null;
  let pendingAnchor = null;
  let activeId = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (parsed && Array.isArray(parsed.items)) return parsed;
    } catch (_) {}
    return { pageId, title: document.title || "HTML Review", items: [] };
  }

  function saveState() {
    state.pageId = pageId;
    state.title = document.title || "HTML Review";
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {
      alert("瀏覽器儲存空間不足。請先匯出 JSON，再清除部分截圖附件。");
    }
    renderSidebar();
    updateCount();
  }

  function uid() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function textNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest("[data-html-review-ui]")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let index = 0;
    let node;
    while ((node = walker.nextNode())) {
      const start = index;
      const value = node.nodeValue;
      index += value.length;
      nodes.push({ node, start, end: index });
    }
    return nodes;
  }

  function fullText() {
    return textNodes().map((x) => x.node.nodeValue).join("");
  }

  function rangeToAnchor(range) {
    const before = range.cloneRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const exact = range.toString();
    return {
      exact,
      prefix: fullText().slice(Math.max(0, start - 40), start),
      suffix: fullText().slice(start + exact.length, start + exact.length + 40),
    };
  }

  function scoreAnchor(text, idx, anchor) {
    let score = 0;
    if (anchor.prefix && text.slice(Math.max(0, idx - anchor.prefix.length), idx) === anchor.prefix) {
      score += 2;
    }
    if (
      anchor.suffix &&
      text.slice(idx + anchor.exact.length, idx + anchor.exact.length + anchor.suffix.length) === anchor.suffix
    ) {
      score += 2;
    }
    return score;
  }

  function rangeFromAnchor(anchor) {
    if (!anchor || !anchor.exact) return null;
    const text = fullText();
    const candidates = [];
    let idx = text.indexOf(anchor.exact);
    while (idx !== -1) {
      candidates.push({ idx, score: scoreAnchor(text, idx, anchor) });
      idx = text.indexOf(anchor.exact, idx + Math.max(1, anchor.exact.length));
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return rangeFromOffsets(candidates[0].idx, candidates[0].idx + anchor.exact.length);
  }

  function rangeFromOffsets(start, end) {
    const nodes = textNodes();
    let startNode = null;
    let endNode = null;
    for (const item of nodes) {
      if (!startNode && start >= item.start && start <= item.end) {
        startNode = { node: item.node, offset: start - item.start };
      }
      if (!endNode && end >= item.start && end <= item.end) {
        endNode = { node: item.node, offset: end - item.start };
      }
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode.node, startNode.offset);
    range.setEnd(endNode.node, endNode.offset);
    return range;
  }

  function unwrapExistingMarks() {
    root.querySelectorAll("mark.html-review-mark").forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function applyMark(item) {
    const range = rangeFromAnchor(item.anchor);
    if (!range || !range.toString().trim()) return false;
    const mark = document.createElement("mark");
    mark.className = `html-review-mark html-review-${item.color || "yellow"}`;
    mark.dataset.reviewId = item.id;
    mark.title = item.note ? "有註解" : "高亮";
    try {
      range.surroundContents(mark);
    } catch (_) {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
    }
    return true;
  }

  function refreshMarks() {
    unwrapExistingMarks();
    for (const item of state.items) {
      item.detached = !applyMark(item);
    }
    document.body.classList.toggle("html-review-has-comments", state.items.length > 0);
  }

  function escapeMd(text) {
    return String(text || "").replace(/\r\n/g, "\n");
  }

  function buildMarkdown() {
    const lines = [
      `# HTML Review Feedback: ${document.title || "untitled"}`,
      "",
      `source: ${location.href}`,
      `exported: ${new Date().toISOString()}`,
      "",
    ];
    state.items.forEach((item, index) => {
      lines.push(`## ${index + 1}. ${item.type === "comment" ? "Comment" : "Highlight"}`);
      lines.push("");
      lines.push(`color: ${item.color || "yellow"}`);
      if (item.detached) lines.push("status: detached");
      lines.push("");
      lines.push("> " + escapeMd(item.anchor?.exact || item.quote || "").replace(/\n/g, "\n> "));
      lines.push("");
      if (item.note) {
        lines.push(escapeMd(item.note));
        lines.push("");
      }
      if (item.images && item.images.length) {
        item.images.forEach((img, imgIndex) => {
          lines.push(`image: comment-${String(index + 1).padStart(2, "0")}-image-${String(imgIndex + 1).padStart(2, "0")}`);
        });
        lines.push("");
      }
    });
    return lines.join("\n");
  }

  function download(name, type, text) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const payload = {
      pageId,
      title: document.title || "HTML Review",
      url: location.href,
      exportedAt: new Date().toISOString(),
      items: state.items,
    };
    download("html-review-feedback.json", "application/json", JSON.stringify(payload, null, 2));
  }

  async function copyMarkdown() {
    const md = buildMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      flash("已複製 Markdown");
    } catch (_) {
      download("html-review-feedback.md", "text/markdown", md);
    }
  }

  function flash(text) {
    status.textContent = text;
    setTimeout(() => {
      status.textContent = "";
    }, 1600);
  }

  function makeButton(text, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.className = className || "";
    btn.setAttribute("data-html-review-ui", "1");
    return btn;
  }

  const style = document.createElement("style");
  style.textContent = `
  .html-review-popover,.html-review-tools,.html-review-sidebar,.html-review-modal-card{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .html-review-popover{position:absolute;display:none;z-index:9999;background:#211e17;color:#eadfcd;border:1px solid #4b4134;border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.34);padding:6px;gap:6px}
  .html-review-popover button,.html-review-tools button,.html-review-modal-card button{border:0;border-radius:7px;cursor:pointer;font:600 13px system-ui,sans-serif}
  .html-review-popover button{padding:7px 10px;background:#343025;color:#eadfcd;border:1px solid #5a4e3d}
  .html-review-tools{position:fixed;right:18px;bottom:18px;z-index:9998;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
  .html-review-tools button{padding:9px 13px;background:#62765c;color:#f0e6d2;box-shadow:0 6px 18px rgba(0,0,0,.28)}
  .html-review-tools .secondary{background:#40382d}
  .html-review-status{min-height:18px;color:#d2c39e;background:#252119;border:1px solid #4b4134;border-radius:999px;padding:4px 10px;font-size:12px}
  .html-review-sidebar{position:absolute;right:18px;top:42px;width:310px;z-index:9997;display:none}
  body.html-review-has-comments .html-review-sidebar{display:block}
  .html-review-card{background:#252119;border:1px solid #4b4134;border-radius:8px;padding:12px;margin:0 0 10px;box-shadow:0 8px 24px rgba(0,0,0,.24);cursor:pointer;color:#e8dcc7}
  .html-review-card.active{border-color:#9aaa88;box-shadow:0 0 0 2px rgba(154,170,136,.22)}
  .html-review-card blockquote{margin:0 0 8px;padding:0 0 0 9px;border-left:3px solid #c8b27a;color:#aa9a82;font-size:12px}
  .html-review-note{white-space:pre-wrap;font-size:13px;color:#e8dcc7}
  .html-review-card-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:9px}
  .html-review-card-actions button{border:1px solid #5a4e3d;background:#2e2a21;color:#e8dcc7;border-radius:6px;padding:5px 8px;cursor:pointer}
  .html-review-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:16px}
  .html-review-modal-card{width:min(620px,100%);background:#252119;color:#e8dcc7;border:1px solid #4b4134;border-radius:10px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.38)}
  .html-review-modal-card textarea{width:100%;min-height:130px;border:1px solid #5a4e3d;border-radius:8px;padding:10px;font:14px system-ui,sans-serif;resize:vertical;background:#191712;color:#e8dcc7}
  .html-review-modal-card input[type="file"]{color:#aa9a82}
  .html-review-modal-row{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap}
  .html-review-color-row{display:flex;gap:8px;margin:10px 0}
  .html-review-swatch{width:28px;height:28px;border-radius:999px;border:2px solid #252119;outline:1px solid #5a4e3d;cursor:pointer}
  .html-review-swatch.selected{outline:3px solid #c8b27a}
  .html-review-images{font-size:12px;color:#aa9a82;margin-top:8px}
  @media (max-width: 1119px){.html-review-sidebar{position:static;width:auto;margin:14px 12px 110px}.html-review-tools{right:12px;bottom:12px}.html-review-tools button{padding:8px 11px}}
  `;
  document.head.appendChild(style);

  const popover = document.createElement("div");
  popover.className = "html-review-popover";
  popover.setAttribute("data-html-review-ui", "1");
  const addHighlight = makeButton("高亮");
  const addComment = makeButton("註解");
  popover.append(addHighlight, addComment);
  document.body.appendChild(popover);

  const sidebar = document.createElement("aside");
  sidebar.className = "html-review-sidebar";
  sidebar.setAttribute("data-html-review-ui", "1");
  document.body.appendChild(sidebar);

  const tools = document.createElement("div");
  tools.className = "html-review-tools";
  tools.setAttribute("data-html-review-ui", "1");
  const status = document.createElement("div");
  status.className = "html-review-status";
  const countBtn = makeButton("回饋 0", "secondary");
  const mdBtn = makeButton("複製 Markdown");
  const jsonBtn = makeButton("下載 JSON", "secondary");
  const clearBtn = makeButton("清除本頁回饋", "secondary");
  tools.append(status, countBtn, mdBtn, jsonBtn, clearBtn);
  document.body.appendChild(tools);

  function updateCount() {
    countBtn.textContent = `回饋 ${state.items.length}`;
  }

  function renderSidebar() {
    refreshMarks();
    sidebar.textContent = "";
    state.items.forEach((item, index) => {
      const card = document.createElement("section");
      card.className = "html-review-card" + (item.id === activeId ? " active" : "");
      card.dataset.id = item.id;
      const quote = document.createElement("blockquote");
      quote.textContent = item.anchor?.exact || item.quote || "(detached)";
      const note = document.createElement("div");
      note.className = "html-review-note";
      note.textContent = item.note || (item.type === "highlight" ? "高亮" : "");
      const meta = document.createElement("div");
      meta.className = "html-review-images";
      meta.textContent = `${index + 1}. ${item.color || "yellow"}${item.images?.length ? ` · image ${item.images.length}` : ""}${item.detached ? " · detached" : ""}`;
      const actions = document.createElement("div");
      actions.className = "html-review-card-actions";
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      const del = document.createElement("button");
      del.textContent = "Delete";
      edit.addEventListener("click", (event) => {
        event.stopPropagation();
        openEditor(item);
      });
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        state.items = state.items.filter((x) => x.id !== item.id);
        saveState();
      });
      actions.append(edit, del);
      card.append(quote, note, meta, actions);
      card.addEventListener("click", () => {
        activeId = item.id;
        document.querySelectorAll(".html-review-active").forEach((x) => x.classList.remove("html-review-active"));
        const mark = root.querySelector(`[data-review-id="${CSS.escape(item.id)}"]`);
        if (mark) {
          mark.classList.add("html-review-active");
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        renderSidebar();
      });
      sidebar.appendChild(card);
    });
  }

  function openEditor(existing) {
    const item =
      existing ||
      {
        id: uid(),
        type: "comment",
        color: "yellow",
        note: "",
        images: [],
        anchor: pendingAnchor,
        quote: pendingAnchor?.exact || "",
        createdAt: new Date().toISOString(),
      };
    const modal = document.createElement("div");
    modal.className = "html-review-modal";
    modal.setAttribute("data-html-review-ui", "1");
    const card = document.createElement("div");
    card.className = "html-review-modal-card";
    const title = document.createElement("h3");
    title.textContent = existing ? "編輯註解" : "新增註解";
    const quote = document.createElement("blockquote");
    quote.textContent = item.anchor?.exact || item.quote || "";
    const colorRow = document.createElement("div");
    colorRow.className = "html-review-color-row";
    let selectedColor = item.color || "yellow";
    colors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = `html-review-swatch html-review-${color}` + (color === selectedColor ? " selected" : "");
      swatch.title = color;
      swatch.addEventListener("click", () => {
        selectedColor = color;
        colorRow.querySelectorAll(".selected").forEach((x) => x.classList.remove("selected"));
        swatch.classList.add("selected");
      });
      colorRow.appendChild(swatch);
    });
    const textarea = document.createElement("textarea");
    textarea.placeholder = "寫下回饋。可以直接把截圖貼到這個視窗，或用下方選擇圖片。";
    textarea.value = item.note || "";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.multiple = true;
    const imageInfo = document.createElement("div");
    imageInfo.className = "html-review-images";
    const images = Array.isArray(item.images) ? item.images.slice() : [];
    const updateImages = () => {
      imageInfo.textContent = images.length ? `已附加 ${images.length} 張圖片` : "尚未附加圖片";
    };
    updateImages();
    const addFiles = (files) => {
      Array.from(files || []).forEach((imgFile) => {
        if (!imgFile.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
          images.push({ name: imgFile.name || "pasted-image", type: imgFile.type, dataUrl: reader.result });
          updateImages();
        };
        reader.readAsDataURL(imgFile);
      });
    };
    file.addEventListener("change", () => addFiles(file.files));
    modal.addEventListener("paste", (event) => {
      const files = [];
      for (const entry of event.clipboardData?.items || []) {
        if (entry.type && entry.type.startsWith("image/")) files.push(entry.getAsFile());
      }
      if (files.length) addFiles(files);
    });
    const row = document.createElement("div");
    row.className = "html-review-modal-row";
    const cancel = makeButton("取消", "secondary");
    const save = makeButton("儲存");
    cancel.addEventListener("click", () => modal.remove());
    save.addEventListener("click", () => {
      item.color = selectedColor;
      item.note = textarea.value.trim();
      item.images = images;
      if (!existing) state.items.push(item);
      saveState();
      modal.remove();
    });
    row.append(file, cancel, save);
    card.append(title, quote, colorRow, textarea, imageInfo, row);
    modal.appendChild(card);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
    textarea.focus();
  }

  function addHighlightOnly() {
    if (!pendingAnchor) return;
    state.items.push({
      id: uid(),
      type: "highlight",
      color: "yellow",
      note: "",
      images: [],
      anchor: pendingAnchor,
      quote: pendingAnchor.exact,
      createdAt: new Date().toISOString(),
    });
    popover.style.display = "none";
    saveState();
    window.getSelection()?.removeAllRanges();
  }

  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
        popover.style.display = "none";
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        popover.style.display = "none";
        return;
      }
      pendingRange = range.cloneRange();
      pendingAnchor = rangeToAnchor(pendingRange);
      const rect = range.getBoundingClientRect();
      popover.style.left = `${rect.left + window.scrollX}px`;
      popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
      popover.style.display = "flex";
    }, 0);
  });

  addHighlight.addEventListener("click", addHighlightOnly);
  addComment.addEventListener("click", () => {
    if (!pendingAnchor) return;
    popover.style.display = "none";
    openEditor(null);
    window.getSelection()?.removeAllRanges();
  });
  mdBtn.addEventListener("click", copyMarkdown);
  jsonBtn.addEventListener("click", exportJson);
  countBtn.addEventListener("click", () => sidebar.scrollIntoView({ behavior: "smooth", block: "start" }));
  clearBtn.addEventListener("click", () => {
    if (!confirm("清除這頁存在瀏覽器裡的所有回饋？請先確認已匯出需要保留的內容。")) return;
    state.items = [];
    saveState();
  });
  root.addEventListener("click", (event) => {
    const mark = event.target.closest("mark.html-review-mark");
    if (!mark) return;
    activeId = mark.dataset.reviewId;
    renderSidebar();
  });

  renderSidebar();
  updateCount();
})();
