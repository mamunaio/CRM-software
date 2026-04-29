-- Fix seed_demo_data: remove invalid RETURNING INTO for multi-row insert
CREATE OR REPLACE FUNCTION public.seed_demo_data(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tm_ids uuid[];
begin
  -- Team members
  insert into public.team_members (user_id, name, role, email) values
    (p_user, 'Tahmid Rahman', 'Account Manager', 'tahmid@agency.com'),
    (p_user, 'Sarah Johnson', 'Sales Lead', 'sarah@agency.com'),
    (p_user, 'Nusrat Jahan', 'Project Manager', 'nusrat@agency.com'),
    (p_user, 'Michael Chen', 'Designer', 'michael@agency.com'),
    (p_user, 'Fatima Akter', 'Developer', 'fatima@agency.com');
  select array_agg(id order by created_at) into tm_ids from public.team_members where user_id = p_user;

  -- Contacts
  insert into public.contacts (user_id, name, company, email, phone, status) values
    (p_user, 'Rashed Hossain', 'Bengal Tech Ltd', 'rashed@bengaltech.com', '+880 1711 234567', 'client'),
    (p_user, 'Emma Wilson', 'Wilson & Co', 'emma@wilsonco.com', '+1 415 555 0102', 'client'),
    (p_user, 'Arif Karim', 'Karim Studios', 'arif@karimstudios.com', '+880 1812 345678', 'lead'),
    (p_user, 'James Patterson', 'Patterson Group', 'james@pattersongroup.com', '+1 212 555 0143', 'client'),
    (p_user, 'Sumaiya Islam', 'Daffodil Marketing', 'sumaiya@daffodil.com', '+880 1913 456789', 'lead'),
    (p_user, 'Olivia Martinez', 'Martinez Co', 'olivia@martinezco.com', '+34 612 345 678', 'client'),
    (p_user, 'Imran Hossain', 'Imran Foods', 'imran@imranfoods.com', '+880 1614 567890', 'inactive'),
    (p_user, 'David Kim', 'Kim Logistics', 'david@kimlog.com', '+82 10 1234 5678', 'lead'),
    (p_user, 'Tanvir Ahmed', 'Tanvir Architects', 'tanvir@tanvirarch.com', '+880 1715 678901', 'client'),
    (p_user, 'Sophia Lee', 'Lee Consulting', 'sophia@leeconsult.com', '+1 650 555 0177', 'lead');

  -- Leads
  insert into public.leads (user_id, name, company, email, source, status, assigned_to, notes) values
    (p_user, 'Arif Karim', 'Karim Studios', 'arif@karimstudios.com', 'referral', 'qualified', tm_ids[1], 'Interested in branding package'),
    (p_user, 'Sumaiya Islam', 'Daffodil Marketing', 'sumaiya@daffodil.com', 'website', 'new', tm_ids[2], 'Submitted contact form'),
    (p_user, 'David Kim', 'Kim Logistics', 'david@kimlog.com', 'social_media', 'contacted', tm_ids[2], 'LinkedIn outreach reply'),
    (p_user, 'Sophia Lee', 'Lee Consulting', 'sophia@leeconsult.com', 'cold_outreach', 'proposal_sent', tm_ids[1], 'Proposal sent on Monday'),
    (p_user, 'Liam Brown', 'Brown Holdings', 'liam@brownhold.com', 'referral', 'new', tm_ids[3], NULL),
    (p_user, 'Mehedi Hasan', 'Hasan Imports', 'mehedi@hasanimports.com', 'website', 'qualified', tm_ids[1], 'Wants demo next week'),
    (p_user, 'Ava Thompson', 'Thompson Media', 'ava@thompsonmedia.com', 'social_media', 'contacted', tm_ids[2], NULL),
    (p_user, 'Rafiq Bhuiyan', 'Bhuiyan Apparel', 'rafiq@bhuiyan.com', 'cold_outreach', 'new', tm_ids[3], 'Cold call follow-up'),
    (p_user, 'Noah Davis', 'Davis Tech', 'noah@davistech.com', 'website', 'converted', tm_ids[1], 'Now a paying client'),
    (p_user, 'Shamima Akter', 'Akter Boutique', 'shamima@akterb.com', 'referral', 'proposal_sent', tm_ids[2], 'Awaiting decision');

  -- Deals
  insert into public.deals (user_id, title, client_name, value, stage, due_date, assigned_to) values
    (p_user, 'Website Redesign', 'Bengal Tech Ltd', 12500, 'proposal', current_date + 14, tm_ids[1]),
    (p_user, 'Brand Identity Package', 'Karim Studios', 8500, 'discovery', current_date + 21, tm_ids[4]),
    (p_user, 'SEO Retainer', 'Wilson & Co', 4500, 'won', current_date + 7, tm_ids[2]),
    (p_user, 'Mobile App MVP', 'Patterson Group', 32000, 'negotiation', current_date + 30, tm_ids[5]),
    (p_user, 'Marketing Campaign', 'Daffodil Marketing', 7800, 'discovery', current_date + 10, tm_ids[2]),
    (p_user, 'E-commerce Build', 'Martinez Co', 18900, 'proposal', current_date + 25, tm_ids[5]),
    (p_user, 'Logo Refresh', 'Lee Consulting', 2400, 'won', current_date - 3, tm_ids[4]),
    (p_user, 'CRM Integration', 'Tanvir Architects', 14200, 'negotiation', current_date + 18, tm_ids[5]),
    (p_user, 'Content Strategy', 'Hasan Imports', 5600, 'lost', current_date - 10, tm_ids[1]),
    (p_user, 'Social Media Mgmt', 'Bhuiyan Apparel', 3200, 'discovery', current_date + 12, tm_ids[2]),
    (p_user, 'Photography Session', 'Akter Boutique', 1800, 'won', current_date - 5, tm_ids[4]);

  -- Invoices
  insert into public.invoices (user_id, invoice_number, client_name, client_email, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total) values
    (p_user, 'INV-001', 'Bengal Tech Ltd', 'rashed@bengaltech.com', current_date - 20, current_date - 5, 'paid', 5000, 10, 500, 5500),
    (p_user, 'INV-002', 'Wilson & Co', 'emma@wilsonco.com', current_date - 15, current_date + 15, 'sent', 4500, 10, 450, 4950),
    (p_user, 'INV-003', 'Patterson Group', 'james@pattersongroup.com', current_date - 40, current_date - 10, 'overdue', 8000, 10, 800, 8800),
    (p_user, 'INV-004', 'Martinez Co', 'olivia@martinezco.com', current_date - 5, current_date + 25, 'sent', 9450, 10, 945, 10395),
    (p_user, 'INV-005', 'Tanvir Architects', 'tanvir@tanvirarch.com', current_date - 60, current_date - 30, 'paid', 7100, 10, 710, 7810),
    (p_user, 'INV-006', 'Karim Studios', 'arif@karimstudios.com', current_date - 2, current_date + 28, 'draft', 4250, 10, 425, 4675),
    (p_user, 'INV-007', 'Lee Consulting', 'sophia@leeconsult.com', current_date - 90, current_date - 60, 'paid', 2400, 0, 0, 2400),
    (p_user, 'INV-008', 'Hasan Imports', 'mehedi@hasanimports.com', current_date - 50, current_date - 20, 'overdue', 2800, 10, 280, 3080),
    (p_user, 'INV-009', 'Bhuiyan Apparel', 'rafiq@bhuiyan.com', current_date - 120, current_date - 90, 'paid', 1600, 10, 160, 1760),
    (p_user, 'INV-010', 'Akter Boutique', 'shamima@akterb.com', current_date - 7, current_date + 23, 'sent', 1800, 0, 0, 1800),
    (p_user, 'INV-011', 'Bengal Tech Ltd', 'rashed@bengaltech.com', current_date - 150, current_date - 120, 'paid', 6200, 10, 620, 6820);

  insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount, position)
  select id, 'Professional services', 1, subtotal, subtotal, 0 from public.invoices where user_id = p_user;

  -- Tasks
  insert into public.tasks (user_id, title, linked_contact_name, priority, status, due_date) values
    (p_user, 'Follow up with Arif Karim', 'Arif Karim', 'high', 'pending', current_date),
    (p_user, 'Send proposal to Sophia Lee', 'Sophia Lee', 'high', 'in_progress', current_date + 1),
    (p_user, 'Design review with Bengal Tech', 'Rashed Hossain', 'medium', 'pending', current_date + 3),
    (p_user, 'Call David Kim', 'David Kim', 'medium', 'pending', current_date - 1),
    (p_user, 'Prepare invoice for Martinez Co', 'Olivia Martinez', 'high', 'done', current_date - 5),
    (p_user, 'Update Kanban board', NULL, 'low', 'in_progress', current_date + 7),
    (p_user, 'Quarterly client review', 'James Patterson', 'high', 'pending', current_date + 5),
    (p_user, 'Onboard new designer', NULL, 'medium', 'pending', current_date + 14),
    (p_user, 'Send contract to Tanvir', 'Tanvir Ahmed', 'high', 'pending', current_date - 2),
    (p_user, 'Team standup notes', NULL, 'low', 'done', current_date - 1),
    (p_user, 'Finalize Q4 strategy', NULL, 'medium', 'in_progress', current_date + 10);
end;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();