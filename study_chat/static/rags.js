"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const courseListEl = document.getElementById('course-list');
    const svg = document.getElementById('network-svg');
    const analyzeEl = document.getElementById('analyze-panel');
    const graphTitle = document.getElementById('graph-title');
    const SVGNS = 'http://www.w3.org/2000/svg';

    const COLORS = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e', grey: '#9ca3af' };

    let courses = [];
    let activeCourse = null;

    async function load() {
        try {
            const res = await fetch('/api/rags/performance');
            const data = await res.json();
            courses = data.courses || [];
            if (!courses.length) {
                courseListEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem;">No courses found.</div>`;
                return;
            }
            renderSidebar();
            // Default to first assessed course, else first course.
            const firstAssessed = courses.find(c => c.assessed) || courses[0];
            selectCourse(firstAssessed.id, true);
        } catch (err) {
            console.error(err);
            courseListEl.innerHTML = `<div style="color: #ef4444; font-size: 0.9rem;">Failed to load performance data.</div>`;
        }
    }

    // --- SIDEBAR (course dropdowns) ---
    function renderSidebar() {
        courseListEl.innerHTML = '';
        courses.forEach(course => {
            const acc = document.createElement('div');
            acc.className = 'course-acc';
            acc.dataset.courseId = course.id;

            const header = document.createElement('div');
            header.className = 'course-acc-header';
            header.innerHTML = `<i class="rag-dot rag-${course.status}"></i><span style="flex:1;">${esc(course.name)}</span><span style="font-size:0.8rem;">▾</span>`;

            const body = document.createElement('div');
            body.className = 'course-acc-body';

            course.lectures.forEach(lec => {
                if (course.lectures.length > 1 || lec.name !== 'Course Topics') {
                    const ll = document.createElement('div');
                    ll.className = 'lecture-label';
                    ll.innerHTML = `<i class="rag-dot rag-${lec.status}" style="width:8px;height:8px;"></i> ${esc(lec.name)}`;
                    ll.style.display = 'flex';
                    ll.style.alignItems = 'center';
                    ll.style.gap = '0.4rem';
                    body.appendChild(ll);
                }
                lec.topics.forEach(t => {
                    const row = document.createElement('div');
                    row.className = 'topic-row';
                    const scoreTxt = t.score === null ? '—' : `${t.score}%`;
                    row.innerHTML = `<i class="rag-dot rag-${t.status}"></i><span class="t-name" title="${esc(t.name)}">${esc(t.short_name || t.name)}</span><span class="t-score">${scoreTxt}</span>`;
                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!activeCourse || activeCourse.id !== course.id) selectCourse(course.id);
                        showAnalyze(t, lec, course);
                        highlightNode(t.id);
                    });
                    body.appendChild(row);
                });
            });

            header.addEventListener('click', () => {
                const isOpen = body.classList.contains('open');
                selectCourse(course.id);
                if (!isOpen) body.classList.add('open');
            });

            acc.appendChild(header);
            acc.appendChild(body);
            courseListEl.appendChild(acc);
        });
    }

    function selectCourse(courseId, keepClosed) {
        activeCourse = courses.find(c => c.id === courseId);
        if (!activeCourse) return;
        graphTitle.textContent = activeCourse.name;
        document.querySelectorAll('.course-acc-header').forEach(h => h.classList.remove('active-course'));
        document.querySelectorAll('.course-acc-body').forEach(b => b.classList.remove('open'));
        const acc = courseListEl.querySelector(`[data-course-id="${cssEsc(courseId)}"]`);
        if (acc) {
            acc.querySelector('.course-acc-header').classList.add('active-course');
            if (!keepClosed) acc.querySelector('.course-acc-body').classList.add('open');
        }
        drawNetwork(activeCourse);
    }

    // --- RADIAL NETWORK (course -> lectures -> topics) ---
    function drawNetwork(course) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const rect = svg.getBoundingClientRect();
        const W = Math.max(rect.width, 320);
        const H = Math.max(rect.height, 320);
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const cx = W / 2, cy = H / 2;
        const R1 = Math.min(W, H) * 0.22;  // lecture ring
        const R2 = Math.min(W, H) * 0.40;  // topic ring

        const edgesG = mk('g');
        const nodesG = mk('g');
        svg.appendChild(edgesG);
        svg.appendChild(nodesG);

        const lectures = course.lectures;
        const nLec = lectures.length;

        lectures.forEach((lec, li) => {
            const lecAngle = (li / nLec) * 2 * Math.PI - Math.PI / 2;
            const lx = cx + R1 * Math.cos(lecAngle);
            const ly = cy + R1 * Math.sin(lecAngle);

            edgesG.appendChild(edge(cx, cy, lx, ly, 1.5));

            const topics = lec.topics;
            const span = (2 * Math.PI / nLec) * 0.8;
            topics.forEach((t, ti) => {
                const frac = topics.length === 1 ? 0.5 : ti / (topics.length - 1);
                const tAngle = lecAngle - span / 2 + frac * span;
                const tx = cx + R2 * Math.cos(tAngle);
                const ty = cy + R2 * Math.sin(tAngle);
                edgesG.appendChild(edge(lx, ly, tx, ty, 1));
                nodesG.appendChild(node(tx, ty, 13, COLORS[t.status], compactTopicName(t.short_name || t.name), () => {
                    showAnalyze(t, lec, course);
                }, t.id, t.score === null ? '' : String(t.score)));
            });

            const lecLabel = (nLec === 1 && lec.name === 'Course Topics') ? '' : shortLabel(lec.name);
            nodesG.appendChild(node(lx, ly, 18, COLORS[lec.status], lecLabel, () => {
                showLectureAnalyze(lec, course);
            }, 'lec-' + li, ''));
        });

        nodesG.appendChild(node(cx, cy, 30, COLORS[course.status], shortLabel(course.name), () => {
            showCourseAnalyze(course);
        }, 'course', ''));
    }

    function edge(x1, y1, x2, y2, w) {
        const l = mk('line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1);
        l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', 'var(--border)');
        l.setAttribute('stroke-width', w);
        l.setAttribute('opacity', '0.7');
        return l;
    }

    function node(x, y, r, color, label, onClick, id, badge) {
        const g = mk('g');
        g.setAttribute('class', 'net-node');
        g.setAttribute('transform', `translate(${x},${y})`);
        g.dataset.nodeId = id;

        const c = mk('circle');
        c.setAttribute('r', r);
        c.setAttribute('fill', color);
        c.setAttribute('stroke', 'rgba(0,0,0,0.15)');
        c.setAttribute('stroke-width', '1.5');
        g.appendChild(c);

        if (badge) {
            const bt = mk('text');
            bt.setAttribute('text-anchor', 'middle');
            bt.setAttribute('dy', '0.35em');
            bt.setAttribute('font-size', '10');
            bt.setAttribute('font-weight', '700');
            bt.setAttribute('fill', '#fff');
            const value = mk('tspan');
            value.textContent = badge;
            bt.appendChild(value);
            const pct = mk('tspan');
            pct.setAttribute('font-size', '6.5');
            pct.setAttribute('font-weight', '600');
            pct.setAttribute('dx', '0.5');
            pct.setAttribute('dy', '-0.15em');
            pct.textContent = '%';
            bt.appendChild(pct);
            g.appendChild(bt);
        }

        if (label) {
            const t = mk('text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('y', r + 14);
            t.setAttribute('font-size', '10.5');
            t.setAttribute('fill', 'var(--text-main)');
            t.textContent = label;
            g.appendChild(t);
        }

        g.addEventListener('click', onClick);
        return g;
    }

    function highlightNode(id) {
        document.querySelectorAll('.net-node circle').forEach(c => c.setAttribute('stroke', 'rgba(0,0,0,0.15)'));
        const g = svg.querySelector(`.net-node[data-node-id="${cssEsc(id)}"] circle`);
        if (g) { g.setAttribute('stroke', 'var(--text-main)'); g.setAttribute('stroke-width', '3'); }
    }

    // --- ANALYZE PANEL ---
    const STATUS_TEXT = { green: 'Strong', amber: 'Developing', red: 'Needs work', grey: 'Not assessed' };

    function statusPill(status, label) {
        return `<span style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-muted);">
            <i class="rag-dot rag-${status}"></i>${label || STATUS_TEXT[status]}</span>`;
    }

    function showAnalyze(t, lec, course) {
        highlightNode(t.id);
        const scoreTxt = t.score === null ? 'Not yet assessed' : `${t.score}%`;
        analyzeEl.innerHTML = `
            <h3>${esc(t.name)}</h3>
            <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:0.6rem;">
                ${statusPill(t.status)}
                <span style="font-size:0.8rem;color:var(--text-muted);">Score: <strong style="color:var(--text-main);">${scoreTxt}</strong></span>
                <span style="font-size:0.8rem;color:var(--text-muted);">Attempts: <strong style="color:var(--text-main);">${t.attempts}</strong></span>
                <span style="font-size:0.8rem;color:var(--text-muted);">${esc(course.name)} · ${esc(lec.name)}</span>
            </div>
            <div style="font-size:0.85rem;line-height:1.5;color:var(--text-main);">
                ${t.feedback ? esc(t.feedback) : 'No quiz feedback yet. Complete a quiz to update this topic status.'}
            </div>`;
    }

    function showLectureAnalyze(lec, course) {
        const rows = lec.topics.map(t => {
            const s = t.score === null ? '—' : t.score + '%';
            return `<div class="topic-row" style="cursor:default;"><i class="rag-dot rag-${t.status}"></i><span class="t-name">${esc(t.name)}</span><span class="t-score">${s}</span></div>`;
        }).join('');
        analyzeEl.innerHTML = `<h3>${esc(lec.name)}</h3>
            <div style="margin-bottom:0.5rem;">${statusPill(lec.status)}</div>${rows}`;
    }

    function showCourseAnalyze(course) {
        const total = course.lectures.reduce((a, l) => a + l.topics.length, 0);
        const assessed = course.lectures.reduce((a, l) => a + l.topics.filter(t => t.score !== null).length, 0);
        analyzeEl.innerHTML = `<h3>${esc(course.name)}</h3>
            <div style="margin-bottom:0.5rem;">${statusPill(course.status, 'Overall: ' + STATUS_TEXT[course.status])}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);">${assessed} of ${total} topics assessed across ${course.lectures.length} lecture(s).</div>`;
    }

    // --- helpers ---
    function mk(tag) { return document.createElementNS(SVGNS, tag); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
    function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
    function shortLabel(s) { s = s || ''; return s.length > 22 ? s.slice(0, 20) + '…' : s; }
    function compactTopicName(s) {
        s = s || '';
        const cleaned = s.replace(/\bAlgorithm\b/g, '').replace(/\s+/g, ' ').trim();
        return cleaned.length > 16 ? cleaned.slice(0, 14).trim() + '...' : cleaned;
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (activeCourse) drawNetwork(activeCourse); }, 150);
    });

    load();
});
