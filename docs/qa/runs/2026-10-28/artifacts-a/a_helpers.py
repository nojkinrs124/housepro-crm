# Хелперы QA-агента A (HousePro CRM). Загружать: exec(open('.../a_helpers.py').read())
import json, time

STAGES = ['Поиск и контакт', 'Встреча', 'Договор с собственником', 'Подготовка и реклама',
          'Показы', 'Проверка и договор найма', 'Заселение', 'Завершена']


def reload(path, wait=4):
    """Жёсткая перезагрузка страницы (обход устаревшего DOM)."""
    goto_url('http://192.168.3.14:3100' + path)
    wait_for_load(); time.sleep(wait)
    if '/login' in js('location.pathname'):
        crm_login(path); time.sleep(wait)
    return js('location.pathname')


def _rect(expr):
    return js("""(() => { const b = %s; if(!b) return null;
      b.scrollIntoView({block:'center'}); const q=b.getBoundingClientRect();
      return [q.x+q.width/2, q.y+q.height/2]; })()""" % expr)


def click_text(text, exact=True, wait=2.5, scope='main'):
    """Клик по кнопке/ссылке с точным (или префиксным) текстом."""
    cmp_ = ('=== %r' % text) if exact else ('.startsWith(%r)' % text)
    expr = """[...document.querySelectorAll('%s button, %s a')].find(x=>x.innerText.trim()%s)""" % (
        scope, scope, cmp_)
    r = _rect(expr)
    if not r:
        return 'NOTFOUND'
    click_at_xy(r[0], r[1]); time.sleep(wait)
    return 'OK'


def buttons():
    """Список кнопок/ссылок в main с href."""
    return js("""(() => [...document.querySelectorAll('main button, main a')]
      .map(e=>({t:e.innerText.trim().replace(/\\n/g,' | '), href:e.getAttribute('href'),
                aria:e.getAttribute('aria-label')}))
      .filter(x=>x.t || x.aria))()""")


def main_text(n=1500, tail=False):
    if tail:
        return js("document.querySelector('main').innerText.slice(-%d)" % n)
    return js("document.querySelector('main').innerText.slice(0,%d)" % n)


def stage_state():
    """Текущая стадия + чек-лист."""
    return js("""(() => { const m=document.querySelector('main').innerText;
      const i=m.indexOf('СТАДИЯ «'); if(i<0) return {stage:null, text:m.slice(0,400)};
      const j=m.indexOf('ОБЪЕКТ И УСЛОВИЯ');
      return {stage: m.slice(i+8, m.indexOf('»', i)).trim(), checklist: m.slice(i, j<0?i+600:j)}; })()""")


def tick_required(max_n=12):
    """Отмечает все обязательные пункты чек-листа текущей стадии."""
    done = []
    for _ in range(max_n):
        t = js("""(() => { const b=[...document.querySelectorAll('main button')]
          .find(x=>/обязательно$/.test(x.innerText.trim())); return b? b.innerText.trim():null; })()""")
        if not t:
            break
        r = click_text(t, exact=True, wait=2.5)
        done.append((t.replace('\n', ' ')[:60], r))
        if r == 'NOTFOUND':
            break
    return done


def tick_items(names):
    """Отмечает перечисленные пункты чек-листа (по префиксу текста)."""
    res = []
    for n in names:
        r = click_text(n, exact=False, wait=2.5)
        res.append((n, r))
    return res


def next_stage(cur):
    idx = STAGES.index(cur) if cur in STAGES else 0
    return STAGES[min(idx + 1, len(STAGES) - 1)]


def step_forward(extra_ticks=None):
    """Отмечает обязательные пункты, жмёт следующую стадию, перезагружает и возвращает состояние."""
    st = stage_state()
    cur = st.get('stage')
    ticked = tick_required()
    if extra_ticks:
        tick_items(extra_ticks)
    nxt = next_stage(cur)
    r = click_text(nxt, exact=True, wait=4)
    if r == 'NOTFOUND':
        return {'from': cur, 'to': nxt, 'res': 'NOTFOUND', 'ticked': ticked,
                'err': errors_on_page(), 'stage': stage_state()}
    reload(js('location.pathname'))
    return {'from': cur, 'to': nxt, 'res': r, 'ticked': ticked,
            'err': None, 'stage': stage_state()}


def move_to(target):
    """Двигает сделку к стадии target, отмечая обязательные пункты по пути."""
    log = []
    for _ in range(9):
        st = stage_state()
        cur = st.get('stage')
        log.append({'stage': cur, 'checklist': st.get('checklist', '')[:400]})
        if cur == target:
            return {'ok': True, 'steps': log, 'stage': cur}
        res = step_forward()
        log.append({k: res[k] for k in ('from', 'to', 'res', 'ticked')})
        if res.get('err'):
            log.append({'err': [e for e in res['err'] if 'Выйти' not in e and 'Отменить' not in e]})
        st2 = res.get('stage') or stage_state()
        log.append({'now': st2.get('stage')})
        if st2.get('stage') == cur:
            return {'ok': False, 'steps': log, 'stage': cur, 'note': 'стадия не изменилась'}
    return {'ok': False, 'steps': log}


def save_json(path, obj):
    open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, indent=1))
