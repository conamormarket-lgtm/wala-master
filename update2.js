const fs = require('fs');

let c = fs.readFileSync('src/pages/SubscriptionSurveyPage.jsx', 'utf8');

const target = `                      {tempRecipient.familySet && (
                        <div style={{ marginTop: '1rem' }}>
                          <div className={styles.fieldGroup}>
                            <label>¿Es para {tempRecipient.gender === 'Masculino' ? 'él' : tempRecipient.gender === 'Femenino' ? 'ella' : 'él o ella'}?</label>
                            <input 
                              type="text" 
                              className={styles.input} 
                              placeholder="Ej. Ropa, reloj..."
                              value={tempRecipient.familyAnswers?.q1 || ''} 
                              onChange={e => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q1: e.target.value })} 
                            />
                          </div>
                          <div className={styles.fieldGroup}>
                            <label>¿Es para ambos?</label>
                            <input 
                              type="text" 
                              className={styles.input} 
                              placeholder="Ej. Un viaje, cena..."
                              value={tempRecipient.familyAnswers?.q2 || ''} 
                              onChange={e => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q2: e.target.value })} 
                            />
                          </div>
                          <div className={styles.fieldGroup}>
                            <label>¿Es para más personas?</label>
                            <input 
                              type="text" 
                              className={styles.input} 
                              placeholder="Ej. Juego de mesa familiar..."
                              value={tempRecipient.familyAnswers?.q3 || ''} 
                              onChange={e => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q3: e.target.value })} 
                            />
                          </div>
                        </div>
                      )}`;

const replacement = `                      {tempRecipient.familySet && (
                        <div className={styles.pillsContainer} style={{ marginTop: '1.5rem', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            className={\`\${styles.pillBtn} \${tempRecipient.familyAnswers?.q1 ? styles.pillSelected : ''}\`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q1: !tempRecipient.familyAnswers?.q1 })}
                          >
                            Es para {tempRecipient.gender === 'Masculino' ? 'él' : tempRecipient.gender === 'Femenino' ? 'ella' : 'él o ella'}
                          </button>
                          
                          <button
                            type="button"
                            className={\`\${styles.pillBtn} \${tempRecipient.familyAnswers?.q2 ? styles.pillSelected : ''}\`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q2: !tempRecipient.familyAnswers?.q2 })}
                          >
                            Es para ambos
                          </button>

                          <button
                            type="button"
                            className={\`\${styles.pillBtn} \${tempRecipient.familyAnswers?.q3 ? styles.pillSelected : ''}\`}
                            onClick={() => handleTempChange('familyAnswers', { ...tempRecipient.familyAnswers, q3: !tempRecipient.familyAnswers?.q3 })}
                          >
                            Es para más personas
                          </button>
                        </div>
                      )}`;

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync('src/pages/SubscriptionSurveyPage.jsx', c);
    console.log('Replaced successfully');
} else {
    console.log('Target block not found');
}
