import { owner, reminders, upcoming, widgets } from "@/lib/data";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

export default function Dashboard() {
  return (
    <>
      <main className="stage">
        <div className="grid">
          {widgets.map((w) => (
            <article key={w.title} className="widget">
              <h4>{w.title}</h4>
              <p className="big">{w.big}</p>
              <p className="sub">{w.sub}</p>
              {w.bars && <div className="bars">{w.bars.map((b, i) => <i key={i} style={{ height: `${b}%` }} />)}</div>}
            </article>
          ))}
        </div>
      </main>
      <aside className="side">
        <List title="Reminder" items={reminders} />
        <List title="Upcoming" items={upcoming} />
        <div className="chat">
          <h2>Hi {owner}, how can we help you?</h2>
          <form className="pill" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="Ask your team anything" aria-label="Message" />
            <button aria-label="Send">↑</button>
          </form>
        </div>
      </aside>
    </>
  );
}
