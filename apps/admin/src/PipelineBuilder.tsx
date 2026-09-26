import { useState } from 'react';
import { Plus, GripVertical, Trash2, ArrowLeft, Check, Sparkles } from 'lucide-react';

export default function PipelineBuilder({ onBack }: { onBack: () => void }) {
  const [pipelineName, setPipelineName] = useState('');
  const [stages, setStages] = useState([
    { id: 1, name: 'Triagem', color: 'var(--pipe-triage)' },
    { id: 2, name: 'Contato Feito', color: '#8b5cf6' },
    { id: 3, name: 'Negociação', color: 'var(--pipe-progress)' },
    { id: 4, name: 'Ganho', color: 'var(--pipe-won)' },
  ]);

  const addStage = () => {
    setStages([...stages, { id: Date.now(), name: 'Nova Etapa', color: '#64748b' }]);
  };

  const removeStage = (id: number) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const updateStageName = (id: number, name: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, name } : s));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', padding: '40px 60px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
        
        {/* Navigation & Header */}
        <button 
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '32px', padding: 0, fontWeight: 500 }}
        >
          <ArrowLeft size={16} /> Voltar para o CRM
        </button>

        <h1 className="text-3xl font-bold mb-2">Criar nova Pipeline</h1>
        <p className="text-muted mb-10">Configure o fluxo de vendas para um novo produto, serviço ou equipe.</p>

        {/* Formulário Principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Nome da Pipeline */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Nome da Pipeline</label>
            <input 
              type="text" 
              placeholder="Ex: Parcerias B2B Q4"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              style={{
                width: '100%', padding: '16px 20px', fontSize: '18px', 
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', outline: 'none', color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          {/* Etapas */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Etapas do Funil (Estágios)</label>
              <button 
                onClick={addStage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '13px' }}
              >
                <Plus size={14} /> Adicionar Etapa
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stages.map((stage) => (
                <div key={stage.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', 
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', 
                  padding: '12px 16px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ cursor: 'grab', color: 'var(--text-muted)' }}>
                    <GripVertical size={16} />
                  </div>
                  
                  {/* Color Indicator */}
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: stage.color }} />
                  
                  <input 
                    type="text"
                    value={stage.name}
                    onChange={(e) => updateStageName(stage.id, e.target.value)}
                    style={{ 
                      flex: 1, background: 'transparent', border: 'none', 
                      fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                  
                  {stages.length > 2 && (
                    <button 
                      onClick={() => removeStage(stage.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                      title="Remover etapa"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dica de Automação */}
          <div style={{ background: 'var(--bg-surface-hover)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-subtle)', display: 'flex', gap: '16px' }}>
            <div style={{ color: 'var(--accent)', marginTop: '2px' }}><Sparkles size={20} /></div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Crie as regras depois</h4>
              <p className="text-sm text-muted">Após criar a Pipeline, você poderá ir na aba de E-mails e configurar automações específicas (como envio de mensagens no WhatsApp ou e-mails) para cada uma dessas etapas.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button 
              onClick={onBack}
              style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              style={{ padding: '12px 24px', background: 'var(--text-primary)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--bg-app)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
            >
              <Check size={16} /> Salvar Pipeline
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
