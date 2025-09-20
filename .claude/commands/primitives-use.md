Convert this component ($ARGUMENTS) to use our src/components/primitives (docs:.readme\docs\features\primitives). 

Priority:

1. **Use primitive props first**: 
   - Text: `variant="strong|subtle|muted"`, `size="sm|base|lg"`
   - Button: `type="primary|secondary|danger"`, `size="small|normal"`  
   - Layout: `<FlexRow gap="sm" justify="between">` vs `className="flex"`

2. **If props aren't enough**: Use Tailwind (`bg-surface-0`, `text-strong`)
3. **Last resort**: Existing CSS or hardcoded styles
