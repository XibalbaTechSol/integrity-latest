import { TraceNode, ReactFlowProvider, Position } from 'integrity-mvp';

const wrap = (node: React.ReactNode) => (
  <ReactFlowProvider>
    <div style={{ position: 'relative', padding: '40px' }}>{node}</div>
  </ReactFlowProvider>
);

export const RootNode = () =>
  wrap(
    <TraceNode
      id="root"
      type="traceNode"
      data={{ type: 'root', title: 'Agent Intent Received', subtitle: 'BCC commitment signed' }}
      selected={false}
      isConnectable={false}
      xPos={0}
      yPos={0}
      zIndex={0}
      dragging={false}
      targetPosition={Position.Left}
      sourcePosition={Position.Right}
    />
  );

export const SuccessNode = () =>
  wrap(
    <TraceNode
      id="success"
      type="traceNode"
      data={{ type: 'success', title: 'Policy Gate Passed', subtitle: 'OPA evaluation: allow' }}
      selected={true}
      isConnectable={false}
      xPos={0}
      yPos={0}
      zIndex={0}
      dragging={false}
      targetPosition={Position.Left}
      sourcePosition={Position.Right}
    />
  );

export const DangerNode = () =>
  wrap(
    <TraceNode
      id="danger"
      type="traceNode"
      data={{ type: 'danger', title: 'Anomalous Swap Blocked', subtitle: 'Unapproved DEX interaction' }}
      selected={false}
      isConnectable={false}
      xPos={0}
      yPos={0}
      zIndex={0}
      dragging={false}
      targetPosition={Position.Left}
      sourcePosition={Position.Right}
    />
  );

export const CryptoNode = () =>
  wrap(
    <TraceNode
      id="crypto"
      type="traceNode"
      data={{ type: 'crypto', title: 'ZK Attestation Verified', subtitle: 'UltraPlonk proof, root #892' }}
      selected={false}
      isConnectable={false}
      xPos={0}
      yPos={0}
      zIndex={0}
      dragging={false}
      targetPosition={Position.Left}
      sourcePosition={Position.Right}
    />
  );
