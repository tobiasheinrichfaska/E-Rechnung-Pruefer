import { useId } from 'react';
import type { RuleResult, RuleStatus, RulesResult } from '../logic/rules';
import { TEXTS } from '../logic/texts';

const STATUS_TEXT: Readonly<Record<RuleStatus, string>> = {
  passt: TEXTS.ruleStatusPasst,
  auffaellig: TEXTS.ruleStatusAuffaellig,
  nichtPruefbar: TEXTS.ruleStatusNichtPruefbar,
};

/** Badge colours as in the Pflichtangaben: passt green, Auffälligkeit red, nicht prüfbar grey. */
const BADGE: Readonly<Record<RuleStatus, string>> = {
  passt: 'badge-vorhanden',
  auffaellig: 'badge-fehlt',
  nichtPruefbar: 'badge-einzelfall',
};

function Rule({ rule }: { rule: RuleResult }) {
  return (
    <li className={`rule rule-${rule.status}`} data-testid={`rule-${rule.id}`}>
      <div className="rule-head">
        <span>
          <strong>{rule.id}</strong>
          {rule.occurrence && <span className="muted"> · {rule.occurrence}</span>}
        </span>
        <span className={`badge ${BADGE[rule.status]}`}>{STATUS_TEXT[rule.status]}</span>
      </div>
      <div className="muted">{rule.label}</div>
      <div className="rule-values">
        {rule.values.map((v) => (
          <span key={v.label}>
            <span className="value-label">{v.label}:</span> {v.value}
          </span>
        ))}
      </div>
    </li>
  );
}

/**
 * Step 3a: the calculation rules of one invoice XML; the irregular ones first and open.
 * `id`: the target of the jump link from the result box (G-1).
 */
export function RulesView({ result, id }: { result: RulesResult; id?: string }) {
  const headingId = useId();
  const irregular = result.results.filter((r) => r.status === 'auffaellig');
  const others = result.results.filter((r) => r.status !== 'auffaellig');
  return (
    <section className="rules" aria-labelledby={headingId} id={id}>
      <h3 id={headingId}>{TEXTS.rulesHeading}</h3>
      <p
        className={`summary ${
          irregular.length > 0 ? 'summary-missing' : result.notChecked > 0 ? '' : 'summary-ok'
        }`}
        data-testid="rules-summary"
      >
        {result.summary}
      </p>
      {/* F23: what the client could do, by the kind of the irregular rules */}
      {result.advice.map((line) => (
        <p key={line} className="rule-advice">
          {line}
        </p>
      ))}
      {result.note && (
        <p className="muted" data-testid="rules-note">
          {result.note}
        </p>
      )}
      {irregular.length > 0 && (
        <ul className="rule-list">
          {irregular.map((rule, index) => (
            <Rule key={`${rule.id}-${index}`} rule={rule} />
          ))}
        </ul>
      )}
      <details className="rules-all">
        <summary>{`${irregular.length > 0 ? TEXTS.rulesShowOthers : TEXTS.rulesShowAll} (${others.length})`}</summary>
        <ul className="rule-list">
          {others.map((rule, index) => (
            <Rule key={`${rule.id}-${index}`} rule={rule} />
          ))}
        </ul>
      </details>
    </section>
  );
}
