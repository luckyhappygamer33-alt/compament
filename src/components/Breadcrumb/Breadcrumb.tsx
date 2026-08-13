import './Breadcrumb.css'

// placeholder data — will come from navigation store later
const crumbs = ['Root']

export default function Breadcrumb() {
    return (
        <div className="breadcrumb">
            {crumbs.map((crumb, i) => (
                <span key={i} className="breadcrumb-item">
                    {i > 0 && <span className="breadcrumb-sep">›</span>}
                    <span
                        className={`breadcrumb-label ${i === crumbs.length - 1 ? 'active' : ''}`}
                    >
                        {crumb}
                    </span>
                </span>
            ))}
        </div>
    )
}